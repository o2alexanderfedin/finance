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
 * ## `subjectKey`
 *
 * Each row also carries the dialect's own declaration of which of ITS fields
 * play the five roles a form subject is keyed on (`fjs/document/subject`'s
 * `SubjectKey`). It rides on the registry row rather than in a second list
 * for the same reason the schema and the validator do: a second list is a
 * list that can drift, and the leaves below turn a drift into a red.
 *
 * `undefined` means the dialect has no business key at all -- exactly two do:
 * `vnd.fjs.ocr` (a verbatim transcription of a scan, addressed by the
 * artifact's own content hash, never by a business identity) and
 * `vnd.fjs.return_profile` (one profile per taxpayer per year, filed under a
 * literal `return-profile/<year>` subject, see `fjs/guest/store_view`).
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
/** @import { SubjectKey } from '../subject/module.f.js' */
import { dialect as oneZeroNineFiveaDialect, oneZeroNineFiveASchema, validate as oneZeroNineFiveaValidate, subjectKey as oneZeroNineFiveaSubjectKey } from '../1095a/module.f.js'
import { dialect as oneZeroNineEighteDialect, oneZeroNineEightESchema, validate as oneZeroNineEighteValidate, subjectKey as oneZeroNineEighteSubjectKey } from '../1098e/module.f.js'
import { dialect as oneZeroNineEighttDialect, oneZeroNineEightTSchema, validate as oneZeroNineEighttValidate, subjectKey as oneZeroNineEighttSubjectKey } from '../1098t/module.f.js'
import { dialect as oneZeroNineNinebDialect, oneZeroNineNineBSchema, validate as oneZeroNineNinebValidate, subjectKey as oneZeroNineNinebSubjectKey } from '../1099b/module.f.js'
import { dialect as oneZeroNineNinedivDialect, oneZeroNineNineDivSchema, validate as oneZeroNineNinedivValidate, subjectKey as oneZeroNineNinedivSubjectKey } from '../1099div/module.f.js'
import { dialect as oneZeroNineNinegDialect, oneZeroNineNineGSchema, validate as oneZeroNineNinegValidate, subjectKey as oneZeroNineNinegSubjectKey } from '../1099g/module.f.js'
import { dialect as oneZeroNineNineintDialect, oneZeroNineNineIntSchema, validate as oneZeroNineNineintValidate, subjectKey as oneZeroNineNineintSubjectKey } from '../1099int/module.f.js'
import { dialect as oneZeroNineNinenecDialect, oneZeroNineNineNecSchema, validate as oneZeroNineNinenecValidate, subjectKey as oneZeroNineNinenecSubjectKey } from '../1099nec/module.f.js'
import { dialect as oneZeroNineNinerDialect, oneZeroNineNineRSchema, validate as oneZeroNineNinerValidate, subjectKey as oneZeroNineNinerSubjectKey } from '../1099r/module.f.js'
import { dialect as adjustmentsDialect, adjustmentsSchema, validate as adjustmentsValidate, subjectKey as adjustmentsSubjectKey } from '../adjustments/module.f.js'
import { dialect as assetRegisterDialect, assetRegisterSchema, validate as assetRegisterValidate, subjectKey as assetRegisterSubjectKey } from '../asset_register/module.f.js'
import { dialect as basisCorrectionDialect, basisCorrectionSchema, validate as basisCorrectionValidate, subjectKey as basisCorrectionSubjectKey } from '../basis_correction/module.f.js'
import { dialect as businessExpensesDialect, businessExpensesSchema, validate as businessExpensesValidate, subjectKey as businessExpensesSubjectKey } from '../business_expenses/module.f.js'
import { dialect as creditsDialect, creditsSchema, validate as creditsValidate, subjectKey as creditsSubjectKey } from '../credits/module.f.js'
import { dialect as farmDialect, farmSchema, validate as farmValidate, subjectKey as farmSubjectKey } from '../farm/module.f.js'
import { dialect as form3921Dialect, formThirtyNineTwentyOneSchema, validate as form3921Validate, subjectKey as form3921SubjectKey } from '../form3921/module.f.js'
import { dialect as form3922Dialect, formThirtyNineTwentyTwoSchema, validate as form3922Validate, subjectKey as form3922SubjectKey } from '../form3922/module.f.js'
import { dialect as iraDialect, iraSchema, validate as iraValidate, subjectKey as iraSubjectKey } from '../ira/module.f.js'
import { dialect as itemizedDeductionsDialect, itemizedDeductionsSchema, validate as itemizedDeductionsValidate, subjectKey as itemizedDeductionsSubjectKey } from '../itemized_deductions/module.f.js'
import { dialect as k11041Dialect, k1EstateTrustSchema, validate as k11041Validate, subjectKey as k11041SubjectKey } from '../k1_1041/module.f.js'
import { dialect as k11065Dialect, k1PartnershipSchema, validate as k11065Validate, subjectKey as k11065SubjectKey } from '../k1_1065/module.f.js'
import { dialect as k11120sDialect, k1SCorporationSchema, validate as k11120sValidate, subjectKey as k11120sSubjectKey } from '../k1_1120s/module.f.js'
import { dialect as medicalExpensesDialect, medicalExpensesSchema, validate as medicalExpensesValidate, subjectKey as medicalExpensesSubjectKey } from '../medical_expenses/module.f.js'
import { dialect as ocrDialect, ocrSchema, validate as ocrValidate } from '../ocr/module.f.js'
import { dialect as priorYearCapitalLossDialect, priorYearCapitalLossSchema, validate as priorYearCapitalLossValidate, subjectKey as priorYearCapitalLossSubjectKey } from '../prior_year_capital_loss/module.f.js'
import { dialect as priorYearIraBasisDialect, priorYearIraBasisSchema, validate as priorYearIraBasisValidate, subjectKey as priorYearIraBasisSubjectKey } from '../prior_year_ira_basis/module.f.js'
import { dialect as rentalPropertyDialect, rentalPropertySchema, validate as rentalPropertyValidate, subjectKey as rentalPropertySubjectKey } from '../rental_property/module.f.js'
import { dialect as ssa1099Dialect, ssa1099Schema, validate as ssa1099Validate, subjectKey as ssa1099SubjectKey } from '../ssa1099/module.f.js'
import { dialect as w2Dialect, w2Schema, validate as w2Validate, subjectKey as w2SubjectKey } from '../w2/module.f.js'
import { dialect as returnProfileDialect, returnProfileSchema, validate as returnProfileValidate } from '../../return/profile/module.f.js'

/**
 * One registry row.
 * @typedef {{
 *     readonly dialect: string,
 *     readonly schema: RttiType,
 *     readonly validate: (value: JsonUnknown) => Result<unknown, unknown>,
 *     readonly enterable: boolean,
 *     readonly subjectKey: SubjectKey | undefined,
 * }} DocumentDialect
 */

/** @type {(dialect: string) => (schema: RttiType) => (validate: (value: JsonUnknown) => Result<unknown, unknown>) => (enterable: boolean) => (subjectKey: SubjectKey | undefined) => DocumentDialect} */
const entry = dialect => schema => validate => enterable => subjectKey => ({ dialect, schema, validate, enterable, subjectKey })

/** Every stored dialect. @type {readonly DocumentDialect[]} */
export const documentDialects = [
    entry(oneZeroNineFiveaDialect)(oneZeroNineFiveASchema)(oneZeroNineFiveaValidate)(true)(oneZeroNineFiveaSubjectKey),
    entry(oneZeroNineEighteDialect)(oneZeroNineEightESchema)(oneZeroNineEighteValidate)(true)(oneZeroNineEighteSubjectKey),
    entry(oneZeroNineEighttDialect)(oneZeroNineEightTSchema)(oneZeroNineEighttValidate)(true)(oneZeroNineEighttSubjectKey),
    entry(oneZeroNineNinebDialect)(oneZeroNineNineBSchema)(oneZeroNineNinebValidate)(true)(oneZeroNineNinebSubjectKey),
    entry(oneZeroNineNinedivDialect)(oneZeroNineNineDivSchema)(oneZeroNineNinedivValidate)(true)(oneZeroNineNinedivSubjectKey),
    entry(oneZeroNineNinegDialect)(oneZeroNineNineGSchema)(oneZeroNineNinegValidate)(true)(oneZeroNineNinegSubjectKey),
    entry(oneZeroNineNineintDialect)(oneZeroNineNineIntSchema)(oneZeroNineNineintValidate)(true)(oneZeroNineNineintSubjectKey),
    entry(oneZeroNineNinenecDialect)(oneZeroNineNineNecSchema)(oneZeroNineNinenecValidate)(true)(oneZeroNineNinenecSubjectKey),
    entry(oneZeroNineNinerDialect)(oneZeroNineNineRSchema)(oneZeroNineNinerValidate)(true)(oneZeroNineNinerSubjectKey),
    entry(adjustmentsDialect)(adjustmentsSchema)(adjustmentsValidate)(true)(adjustmentsSubjectKey),
    entry(assetRegisterDialect)(assetRegisterSchema)(assetRegisterValidate)(true)(assetRegisterSubjectKey),
    entry(basisCorrectionDialect)(basisCorrectionSchema)(basisCorrectionValidate)(true)(basisCorrectionSubjectKey),
    entry(businessExpensesDialect)(businessExpensesSchema)(businessExpensesValidate)(true)(businessExpensesSubjectKey),
    entry(creditsDialect)(creditsSchema)(creditsValidate)(true)(creditsSubjectKey),
    entry(farmDialect)(farmSchema)(farmValidate)(true)(farmSubjectKey),
    entry(form3921Dialect)(formThirtyNineTwentyOneSchema)(form3921Validate)(true)(form3921SubjectKey),
    entry(form3922Dialect)(formThirtyNineTwentyTwoSchema)(form3922Validate)(true)(form3922SubjectKey),
    entry(iraDialect)(iraSchema)(iraValidate)(true)(iraSubjectKey),
    entry(itemizedDeductionsDialect)(itemizedDeductionsSchema)(itemizedDeductionsValidate)(true)(itemizedDeductionsSubjectKey),
    entry(k11041Dialect)(k1EstateTrustSchema)(k11041Validate)(true)(k11041SubjectKey),
    entry(k11065Dialect)(k1PartnershipSchema)(k11065Validate)(true)(k11065SubjectKey),
    entry(k11120sDialect)(k1SCorporationSchema)(k11120sValidate)(true)(k11120sSubjectKey),
    entry(medicalExpensesDialect)(medicalExpensesSchema)(medicalExpensesValidate)(true)(medicalExpensesSubjectKey),
    entry(ocrDialect)(ocrSchema)(ocrValidate)(false)(undefined),
    entry(priorYearCapitalLossDialect)(priorYearCapitalLossSchema)(priorYearCapitalLossValidate)(true)(priorYearCapitalLossSubjectKey),
    entry(priorYearIraBasisDialect)(priorYearIraBasisSchema)(priorYearIraBasisValidate)(true)(priorYearIraBasisSubjectKey),
    entry(rentalPropertyDialect)(rentalPropertySchema)(rentalPropertyValidate)(true)(rentalPropertySubjectKey),
    entry(ssa1099Dialect)(ssa1099Schema)(ssa1099Validate)(true)(ssa1099SubjectKey),
    entry(w2Dialect)(w2Schema)(w2Validate)(true)(w2SubjectKey),
    entry(returnProfileDialect)(returnProfileSchema)(returnProfileValidate)(true)(undefined),
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
    // ── FORM-KEY-01: the subjectKey declarations, checked BOTH ways ──────
    //
    // Direction 1 (coverage): every dialect that has a business key declares
    // one. Asserted the way `onlyTheTranscriptionArtifactIsUnenterable` above
    // asserts its exclusion -- against a HAND-TYPED list of the dialects that
    // legitimately have none, not against a predicate over the field names,
    // because a predicate spelled `'recipientTin' in schema` would re-import
    // the very cross-dialect naming assumption this declaration exists to
    // remove, and would have to be rewritten by the renames that follow.
    //
    // The hand-typed 28 is the count AGENTS.md's fourth shipped defect calls
    // for: a loop over `documentDialects` can never notice that list
    // shrinking, so deleting a dialect's declaration must fail a number that
    // the code under test did not produce.
    everyDialectWithABusinessKeyDeclaresASubjectKey: () => {
        const without = documentDialects.filter(d => d.subjectKey === undefined).map(d => d.dialect)
        assertEq(without.join(), 'vnd.fjs.ocr,vnd.fjs.return_profile')
        assertEq(documentDialects.length - without.length, 28)
    },
    // Direction 2 (validity): every field name a declaration MENTIONS is a
    // real property of that dialect's OWN schema. Direction 1 alone would
    // read a typo -- or a rename applied to the schema and forgotten in the
    // declaration -- as a coincidence: the row still has a `subjectKey`, and
    // the subject it derives is silently keyed on `''`.
    //
    // The names come from `fieldsOf(toJsonSchema(...))`, the same walk the
    // fillable-form leaf above uses, rather than from `Object.keys` on an
    // `RttiType`; `fieldsOf` reports FIXED fields too, which is why `dialect`
    // -- the field every declaration names for its `formType` role -- is
    // found here even though `askedFields` deliberately drops it.
    everySubjectKeyNamesRealPropertiesOfItsOwnSchema: () => {
        for (const { dialect, schema, subjectKey } of documentDialects) {
            if (subjectKey === undefined) {
                continue
            }
            const names = fieldsOf(toJsonSchema(schema)).map(f => f.name)
            for (const declared of [
                subjectKey.formType,
                subjectKey.taxYear,
                subjectKey.payer,
                subjectKey.recipient,
                subjectKey.account,
            ]) {
                if (declared === undefined) {
                    continue
                }
                assert(names.includes(declared),
                    ['a subjectKey names a field this dialect does not have', dialect, declared])
            }
        }
    },
    // The per-role tallies. Direction 1 counts declarations and direction 2
    // checks the names that are there; neither notices a role QUIETLY
    // DROPPED -- `payer` is an optional property, so deleting it still
    // typechecks (deliberately: see `SubjectKey`'s docstring) and still names
    // only real fields. These two hand-typed numbers are what makes such a
    // deletion red.
    //
    // 15 dialects have a payer and 18 have an account number. The thirteen
    // without a payer are mostly facts transcribed off the taxpayer's own
    // return, where there is no issuer at all (`medical_expenses`,
    // `prior_year_capital_loss`, `ira`, `credits`, ...) -- but not only:
    // `1095a` is Marketplace-issued and simply keys on the recipient, and of
    // the ten without an account number `k1_1041` is fiduciary-issued. The
    // roles are optional because a dialect may lack the FIELD, which is not
    // the same claim as "nobody issued this form".
    //
    // Every one of the 28 has both a recipient and a tax year, which is what
    // makes a business key a business key at all.
    theDeclaredRoleTallyIsWhatTheSchemasSupport: () => {
        const declared = documentDialects
            .map(d => d.subjectKey)
            .filter(k => k !== undefined)
        assertEq(declared.length, 28)
        assertEq(declared.filter(k => k.payer !== undefined).length, 15)
        assertEq(declared.filter(k => k.account !== undefined).length, 18)
        for (const k of declared) {
            assert(k.recipient !== '', ['every business key has a recipient role'])
            assert(k.taxYear !== '', ['every business key has a tax-year role'])
            assert(k.formType !== '', ['every business key has a form-type role'])
        }
    },
}
