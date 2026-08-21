/**
 * EXEC-14 — the stored guest program that produces an actual Form 1040
 * return, and the first production caller `form1040Report` has ever had.
 *
 * This module is that program's reference/spec, exactly as
 * `fjs/report/payer/module.f.js` is the payer report's: it is proof-tested
 * here and **never imported by `fjs_run`**. A stored program is
 * materialized text imported by content hash at run time, not a call into
 * this module.
 *
 * ## The forbidden implementation, and the one that ships
 *
 * `REQUIREMENTS.md`'s Out of Scope list rules out a `finance_compute_1040`
 * MCP tool — *"would destroy the thesis permanently. The agent would call
 * it and never author a program again."* A server tool that reads
 * documents, assembles a `Form1040Inputs` and calls `form1040Report` **is**
 * that tool. So the assembling is done **here, by the guest**, in a stored
 * blob with zero `import` statements: the program enumerates subjects,
 * walks head -> revision -> snapshot, decides for itself which stored
 * dialect belongs in which of `Form1040Inputs`' seventeen fields, and decides
 * what to return. The engine reaches it as one pure value on `ctx`
 * (`fjs/guest/tax/module.f.js`), beside `step`/`pure`/`centsFromString`/
 * `centsToString`. No tool is added; `tools/list` is unchanged.
 *
 * ## `taxReturnReportSource` and `taxReturnReport` are kept in sync by hand
 *
 * Following `fjs/report/payer`'s established split (and
 * `fjs-run-integration.test.js`'s before it), this module carries the
 * program's literal source TEXT ({@link taxReturnReportSource} — zero
 * imports, exactly the bytes a real separate process writes to disk and
 * `import()`s) side by side with a REAL JS implementation of the identical
 * logic ({@link taxReturnReport}, exercised under the virtual
 * `interpret`/`hostMap` harness this module's own proofs use). **Neither is
 * derived from the other** — the source is never `taxReturnReport
 * .toString()`, because a stored program's text must be hand-authored prose
 * a reviewer can read, not a serialized closure.
 *
 * The two are kept in sync by hand, with one mechanical assist the payer
 * report does not have: {@link proof.sourceAndTwinDispatchOnTheSameElevenDialects}
 * asserts that every dialect tag the twin dispatches on appears **verbatim
 * inside the source text**, against a hand-typed count of seventeen. That
 * catches the one drift that would otherwise be silent and expensive — a
 * dialect renamed in a `fjs/document/*` module, picked up automatically by
 * the twin (which imports the constant) and missed by the source (which
 * cannot import anything and so spells the tag out).
 *
 * ## Mixed tax years are REFUSED, not filtered and not tolerated
 *
 * Before this phase nothing could reach the engine, so a store holding a
 * 2024 and a 2025 W-2 was a hazard nobody could trigger. **This program is
 * what makes it reachable**, and a confidently wrong return carrying full
 * citations and no warning is exactly the failure TAX-16 exists to prevent.
 * So the program refuses.
 *
 * Refusing is deliberately NOT the same decision as filtering, and it
 * pre-empts nothing. Filtering needs cross-year semantics this project has
 * not settled — and the naive version is demonstrably WRONG:
 * `vnd.fjs.prior_year_capital_loss` carries the PRIOR year by definition
 * (`fjs/document/prior_year_capital_loss`'s own docstring), so "keep only
 * documents matching the run's year" would silently drop a carryover and
 * overstate the tax. Deciding which dialects are year-scoped and how they
 * relate is a rule about the engine's inputs and belongs beside the engine.
 * Refusing needs none of that, is safe at every input, and leaves the
 * eventual rule completely open.
 *
 * The rule, and why it is written the way it is:
 *
 * - **Data-driven, never a hand-typed dialect list.** A document is checked
 *   because it CARRIES a `taxYear` field, not because its dialect appears on
 *   a list of "the ones somebody thought of". That list is the exact defect
 *   AGENTS.md records four shipped instances of, and this phase found a
 *   fifth one module over (`fjs/guest`'s `combinatorsAreNeverOperations`
 *   enumerates four members and cannot see a fifth). A dialect added later
 *   is covered here the moment it carries a year.
 * - **The run's year comes from `ctx.taxParams.taxYear`, never the
 *   profile.** PROV-04 makes the caller's `taxYear` argument authoritative,
 *   and `fjsRunTool` resolves the parameter set from exactly that argument.
 *   A profile disagreeing with it is therefore itself a mismatch worth
 *   refusing — and is refused, since the profile is checked like every other
 *   document.
 * - **`vnd.fjs.prior_year_capital_loss` and `vnd.fjs.prior_year_ira_basis` are
 *   exempt BY NAME**, for the reason above: their years are supposed to
 *   differ. They are the only two exemptions, both are stated at
 *   {@link noteYearMismatch}, and each has its own control leaf
 *   ({@link proof.taxYearRefusal.aPriorYearCarryoverIsExemptAndStillComputes},
 *   {@link proof.taxYearRefusal.aPriorYearIraBasisIsExemptAndStillComputes})
 *   proving the exemption is real rather than assumed.
 *
 *   **The second one was added in Phase 26, and it is the case that shows why
 *   the exemption list is a hazard rather than a convenience.** A dialect
 *   whose year is supposed to differ, added WITHOUT its name here, refuses
 *   every return that uses it — loudly, so not the silent failure — but a
 *   dialect added here WRONGLY lets a genuinely stale document through
 *   silently. Neither direction is checkable from the data, which is exactly
 *   why the list is short, by name, and paired with controls.
 * - **Verified rather than assumed**: all seventeen dialects this program
 *   routes into the engine declare `taxYear: number` as a REQUIRED schema field —
 *   including `vnd.fjs.medical_expenses`, checked by name because it was the
 *   one in doubt, and Phase 24's `vnd.fjs.adjustments` and `vnd.fjs.1098e`,
 *   both of which declare it required for the same reason. The `typeof` guard in {@link noteYearMismatch} is
 *   therefore unreachable for any validated document; it is kept because the
 *   rule is about what a document carries, and writing it as a dialect list
 *   instead would be the defect above.
 * - **Only documents ROUTED into the engine are checked.** This is a
 *   narrowing of "any document carrying a year", chosen because a document
 *   the program skips cannot alter a computed line, while refusing on one
 *   would let an unrelated stored artifact (a `vnd.fjs.ocr` scan of last
 *   year's paperwork) block every return forever. Pinned by
 *   {@link proof.taxYearRefusal.anUnroutedDialectWithAMismatchedYearStillComputes}
 *   so the narrowing is a checked property rather than an accident.
 *
 * The refusal message names all four facts a reader can act on — the
 * document's hash, its dialect, its year, and the run's year. Phase 20's own
 * surviving mutant was a refusal that named the box but not the destination;
 * the lesson is to assert the part of a message that carries information,
 * not the part that is easy to assert, and
 * {@link proof.taxYearRefusal.theRefusalNamesAllFourFacts} does.
 *
 * ## One boundary that remains a boundary
 *
 * **No re-validation, and no validation upstream of it either — this is a
 * TRUST boundary, not a checked one.** A document's bytes are handed to the
 * engine as parsed. `fjs/form1040/core`'s `Stored<T>` docstring is explicit
 * that nothing there re-validates, and the same is true here: `route` below
 * dispatches on `doc.dialect` and stores the value, with no schema or
 * money-exactness check anywhere on the path.
 *
 * **This paragraph claimed the opposite until 2026-08-20**, saying
 * `cas_add`/`evo_add` "already validated them against their dialect". They do
 * not. Upstream's `cas_add` classifies with `detect([revisionDialect,
 * lockDialect, noteDialect])` — three upstream dialects, none of them ours —
 * and `detectFinance` (`fjs/media/dialects`), which does carry the per-dialect
 * checks, reaches production at exactly one site: `cas_refresh`'s read-only
 * count report (`fjs/server/module.f.js:170`). Nothing on the WRITE path
 * validates a finance document at all.
 *
 * What holds today is that every producer calls its dialect's own `validate`
 * before storing — `tax-return-integration.test.js:373-384` does exactly that
 * for its seeds. That is a convention among callers, not an enforced
 * invariant, and calling it one was the defect. Recorded as
 * `fjs/todo/no-dialect-validation-on-the-write-path.md`; found by
 * `/gsd-audit-milestone` on 2026-08-20.
 *
 * ## The two document-set refusals
 *
 * A store with **no** active `vnd.fjs.return_profile` document, and a store
 * with **more than one**. A 1040 has exactly one filer; silently picking
 * whichever profile the enumeration happened to reach last is the shape of
 * error this repository exists to make impossible.
 *
 * ## Enumeration order is sorted, and that is load-bearing for PROV-05
 *
 * The program sorts the subject list before walking it. `evoList`'s own
 * order comes from `buildRunSnapshot`'s fold over `cas.list()`, so writing
 * ANY new blob into the store can reorder it — which would reorder each
 * line's `sources` array and change the result bytes, even for a run pinned
 * to identical inputs. PROV-05's claim is byte-identical reproduction, so
 * the program takes responsibility for the one part of that it can control.
 * {@link proof.subjectEnumerationOrderDoesNotChangeTheResult} pins it.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { interpret } from '../../exec/module.f.js'
import { taxGuestCtx } from '../../guest/tax/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { stringify as jsonText } from '../../json/module.f.js'
import { dialect as returnProfileDialect } from '../../return/profile/module.f.js'
import { dialect as w2Dialect } from '../../document/w2/module.f.js'
import { dialect as oneZeroNineNineIntDialect } from '../../document/1099int/module.f.js'
import { dialect as oneZeroNineNineDivDialect } from '../../document/1099div/module.f.js'
import { dialect as oneZeroNineNineBDialect } from '../../document/1099b/module.f.js'
import { dialect as oneZeroNineNineRDialect } from '../../document/1099r/module.f.js'
import { dialect as ssa1099Dialect } from '../../document/ssa1099/module.f.js'
import { dialect as itemizedDeductionsDialect } from '../../document/itemized_deductions/module.f.js'
import { dialect as medicalExpensesDialect } from '../../document/medical_expenses/module.f.js'
import { dialect as priorYearCapitalLossDialect } from '../../document/prior_year_capital_loss/module.f.js'
import { dialect as oneZeroNineNineGDialect } from '../../document/1099g/module.f.js'
import { dialect as adjustmentsDialect } from '../../document/adjustments/module.f.js'
import { dialect as oneZeroNineEightEDialect } from '../../document/1098e/module.f.js'
import { dialect as oneZeroNineEightTDialect } from '../../document/1098t/module.f.js'
import { dialect as creditsDialect } from '../../document/credits/module.f.js'
import { dialect as oneZeroNineNineNecDialect } from '../../document/1099nec/module.f.js'
import { dialect as businessExpensesDialect } from '../../document/business_expenses/module.f.js'
import { dialect as assetRegisterDialect } from '../../document/asset_register/module.f.js'
import { dialect as rentalPropertyDialect } from '../../document/rental_property/module.f.js'
import { dialect as farmDialect } from '../../document/farm/module.f.js'
import { dialect as iraDialect } from '../../document/ira/module.f.js'
import { dialect as priorYearIraBasisDialect } from '../../document/prior_year_ira_basis/module.f.js'
import { dialect as formThirtyNineTwentyOneDialect } from '../../document/form3921/module.f.js'
import { dialect as formThirtyNineTwentyTwoDialect } from '../../document/form3922/module.f.js'
import { dialect as basisCorrectionDialect } from '../../document/basis_correction/module.f.js'
import { dialect as k1PartnershipDialect } from '../../document/k1_1065/module.f.js'
import { dialect as k1SCorporationDialect } from '../../document/k1_1120s/module.f.js'
import { dialect as k1EstateTrustDialect } from '../../document/k1_1041/module.f.js'
import { dialect as oneZeroNineFiveADialect } from '../../document/1095a/module.f.js'

import { ok } from 'functionalscript/fjs/types/result/module.f.mjs'

/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/types.js' */
/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { CasOp } from '../../guest/module.f.js' */
/** @import { TaxReport } from '../../guest/tax/module.f.js' */
/** @import { Stored } from '../../form1040/core/module.f.js' */
/** @import { Source } from '../line/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { OneZeroNineNineB } from '../../document/1099b/module.f.js' */
/** @import { OneZeroNineNineR } from '../../document/1099r/module.f.js' */
/** @import { Ssa1099 } from '../../document/ssa1099/module.f.js' */
/** @import { ItemizedDeductions } from '../../document/itemized_deductions/module.f.js' */
/** @import { MedicalExpenses } from '../../document/medical_expenses/module.f.js' */
/** @import { PriorYearCapitalLoss } from '../../document/prior_year_capital_loss/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { Adjustments } from '../../document/adjustments/module.f.js' */
/** @import { OneZeroNineEightE } from '../../document/1098e/module.f.js' */
/** @import { OneZeroNineEightT } from '../../document/1098t/module.f.js' */
/** @import { Credits } from '../../document/credits/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { AssetRegister } from '../../document/asset_register/module.f.js' */
/** @import { RentalProperty } from '../../document/rental_property/module.f.js' */
/** @import { Farm } from '../../document/farm/module.f.js' */
/** @import { Ira } from '../../document/ira/module.f.js' */
/** @import { PriorYearIraBasis } from '../../document/prior_year_ira_basis/module.f.js' */
/** @import { FormThirtyNineTwentyOne } from '../../document/form3921/module.f.js' */
/** @import { FormThirtyNineTwentyTwo } from '../../document/form3922/module.f.js' */
/** @import { BasisCorrection } from '../../document/basis_correction/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { OneZeroNineFiveA } from '../../document/1095a/module.f.js' */

// ── The rendered wire shape ──────────────────────────────────────────────────

/**
 * One printed 1040 line as it crosses the guest boundary. `value` is the
 * decimal STRING a `ReportLine.value` bigint projects to, because fjs's JSON
 * `Primitive` has no `bigint` (EXACT-05) and `fjs_run` refuses a result it
 * cannot represent as JSON. `rule` and `sources` cross unchanged — the whole
 * traceability payload, per line, exactly as `fjs/report/line` built it.
 * @typedef {{
 *   readonly rule: string,
 *   readonly value: string,
 *   readonly sources: readonly Source[],
 * }} RenderedLine
 */

/**
 * What the program returns. Both arms are ordinary JSON: a refusal is a
 * VALUE, never a throw, because a throw crossing the guest boundary is an
 * `fjs_run` error taxonomy event rather than a 1040 the taxpayer can read.
 * `unmodeled` carries `fjs/return/scope`'s own kind names verbatim on the
 * engine's refusal arm, and is empty on this program's own two refusals
 * (which are about the document set, not about scope).
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly taxYear: number,
 *   readonly line16Method: string,
 *   readonly qualifiedBusinessLossCarryforward: RenderedLine,
 *   readonly lines: readonly RenderedLine[],
 * } | {
 *   readonly kind: 'error',
 *   readonly message: string,
 *   readonly unmodeled: readonly string[],
 * }} TaxReturnResult
 */

/**
 * Every dialect this program routes into `Form1040Inputs`, as the union the
 * twin's dispatch narrows over. A blob of any other dialect (`vnd.fjs.ocr`,
 * `vnd.fjs.revision`, a future addition) falls straight through
 * {@link collectDocument} untouched — never coerced into a bucket, never
 * treated as a zero.
 * @typedef {ReturnProfile | W2 | OneZeroNineNineInt | OneZeroNineNineDiv | OneZeroNineNineB | OneZeroNineNineR | Ssa1099 | ItemizedDeductions | MedicalExpenses | PriorYearCapitalLoss | OneZeroNineNineG | Adjustments | OneZeroNineEightE | OneZeroNineEightT | Credits | Ira | PriorYearIraBasis | OneZeroNineNineNec | BusinessExpenses | FormThirtyNineTwentyOne | FormThirtyNineTwentyTwo | BasisCorrection | K1Partnership | K1SCorporation | K1EstateTrust | OneZeroNineFiveA | AssetRegister | RentalProperty | Farm} EngineDocument
 */

/**
 * `Form1040Inputs` mid-collection: the same seventeen fields, with `profile`
 * not yet found and a flag for the one ambiguity a second profile creates.
 *
 * `duplicateProfile` is a flag rather than an early return because the walk
 * is a fold — it has nowhere to return to — and because visiting every
 * subject anyway keeps the observed-read set (and therefore the run
 * record's `inputs[]`) an honest account of what the program looked at.
 * `yearMismatch` holds the FIRST offending document, not a list: the walk
 * runs over a sorted subject list, so "first" is deterministic, and a
 * refusal naming one document a reader can go and look at beats a refusal
 * naming five.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile> | undefined,
 *   readonly duplicateProfile: boolean,
 *   readonly yearMismatch: YearMismatch | undefined,
 *   readonly w2s: readonly Stored<W2>[],
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly brokerageForms: readonly Stored<OneZeroNineNineB>[],
 *   readonly retirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly socialSecurityForms: readonly Stored<Ssa1099>[],
 *   readonly itemizedDeductionForms: readonly Stored<ItemizedDeductions>[],
 *   readonly medicalExpenseForms: readonly Stored<MedicalExpenses>[],
 *   readonly capitalLossCarryoverForms: readonly Stored<PriorYearCapitalLoss>[],
 *   readonly unemploymentForms: readonly Stored<OneZeroNineNineG>[],
 *   readonly nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 *   readonly farmForms: readonly Stored<Farm>[],
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[],
 *   readonly tuitionForms: readonly Stored<OneZeroNineEightT>[],
 *   readonly creditForms: readonly Stored<Credits>[],
 *   readonly iraForms: readonly Stored<Ira>[],
 *   readonly priorYearIraBasisForms: readonly Stored<PriorYearIraBasis>[],
 *   readonly isoExerciseForms: readonly Stored<FormThirtyNineTwentyOne>[],
 *   readonly employeeStockPurchaseForms: readonly Stored<FormThirtyNineTwentyTwo>[],
 *   readonly basisCorrectionForms: readonly Stored<BasisCorrection>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 *   readonly marketplaceStatements: readonly Stored<OneZeroNineFiveA>[],
 * }} Collected
 */

/**
 * One document whose stored tax year is not the year this run computes —
 * everything the refusal message needs, carried as data so the message is
 * built in exactly one place per copy (twin and source text alike).
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly dialect: string,
 *   readonly taxYear: number,
 * }} YearMismatch
 */

/**
 * The mixed-year refusal. Names all four facts a reader can act on: WHICH
 * document (by the CAS hash they can `cas_get`), WHAT it is, the year it is
 * stored for, and the year the run was asked for. See the module header for
 * why the message's informative half is asserted rather than its easy half.
 * @type {(mismatch: YearMismatch) => (runYear: number) => string}
 */
const yearMismatchMessage = mismatch => runYear =>
    `document ${mismatch.documentHash} (${mismatch.dialect}) is stored for tax year `
    + `${mismatch.taxYear}, but this run computes tax year ${runYear}; refusing rather than `
    + `mixing tax years`

/** The two refusals this program raises about the document set itself. */
const noProfileMessage =
    'no active vnd.fjs.return_profile document; a 1040 cannot be computed without one'
const duplicateProfileMessage =
    'more than one active vnd.fjs.return_profile document; a return has exactly one filer'

// ── The stored program's real source text ────────────────────────────────────

/**
 * The guest program's REAL source text — zero imports (so `checkSpecifiers`
 * passes when a real process materializes it), written against nothing but
 * `ctx` (`fjs/guest/tax/module.f.js`'s widened ABI, which is
 * `fjs/guest/module.f.js`'s frozen four commands plus the combinators, the
 * money helpers, `taxParams` and the already-parameterized engine).
 *
 * Line for line, this is {@link taxReturnReport} below with the types
 * erased. Read it as the specification of what a stored 1040 program looks
 * like: enumerate, sort, walk, bucket, call the engine, render.
 * @type {string}
 */
export const taxReturnReportSource = [
    'export const report = ctx => args => ctx.step(ctx.evoList(\'false\'), activeJson => {',
    '    const empty = {',
    '        profile: undefined,',
    '        duplicateProfile: false,',
    '        yearMismatch: undefined,',
    '        w2s: [],',
    '        interestForms: [],',
    '        dividendForms: [],',
    '        brokerageForms: [],',
    '        retirementForms: [],',
    '        socialSecurityForms: [],',
    '        itemizedDeductionForms: [],',
    '        medicalExpenseForms: [],',
    '        capitalLossCarryoverForms: [],',
    '        unemploymentForms: [],',
    '        nonemployeeCompensationForms: [],',
    '        businessExpenseForms: [],',
    '        assetRegisters: [],',
    '        rentalProperties: [],',
    '        farmForms: [],',
    '        adjustmentForms: [],',
    '        studentLoanInterestForms: [],',
    '        tuitionForms: [],',
    '        creditForms: [],',
    '        iraForms: [],',
    '        priorYearIraBasisForms: [],',
    '        isoExerciseForms: [],',
    '        employeeStockPurchaseForms: [],',
    '        basisCorrectionForms: [],',
    '        partnershipK1Forms: [],',
    '        sCorporationK1Forms: [],',
    '        estateTrustK1Forms: [],',
    '        marketplaceStatements: [],',
    '    }',
    '    const runYear = ctx.taxParams.taxYear',
    '    const noteYearMismatch = documentHash => doc => acc => {',
    '        if (acc.yearMismatch !== undefined) { return acc }',
    '        if (doc.dialect === \'vnd.fjs.prior_year_capital_loss\') { return acc }',
    '        if (doc.dialect === \'vnd.fjs.prior_year_ira_basis\') { return acc }',
    '        const year = doc.taxYear',
    '        if (typeof year !== \'number\') { return acc }',
    '        if (year === runYear) { return acc }',
    '        return { ...acc, yearMismatch: { documentHash, dialect: doc.dialect, taxYear: year } }',
    '    }',
    '    const route = documentHash => doc => acc => {',
    '        const stored = { documentHash, value: doc }',
    '        if (doc.dialect === \'vnd.fjs.return_profile\') {',
    '            return acc.profile === undefined',
    '                ? { ...acc, profile: stored }',
    '                : { ...acc, duplicateProfile: true }',
    '        }',
    '        if (doc.dialect === \'vnd.fjs.w2\') { return { ...acc, w2s: [...acc.w2s, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099int\') { return { ...acc, interestForms: [...acc.interestForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099div\') { return { ...acc, dividendForms: [...acc.dividendForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099b\') { return { ...acc, brokerageForms: [...acc.brokerageForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099r\') { return { ...acc, retirementForms: [...acc.retirementForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.ssa1099\') { return { ...acc, socialSecurityForms: [...acc.socialSecurityForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.itemized_deductions\') { return { ...acc, itemizedDeductionForms: [...acc.itemizedDeductionForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.medical_expenses\') { return { ...acc, medicalExpenseForms: [...acc.medicalExpenseForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.prior_year_capital_loss\') { return { ...acc, capitalLossCarryoverForms: [...acc.capitalLossCarryoverForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099g\') { return { ...acc, unemploymentForms: [...acc.unemploymentForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1099nec\') { return { ...acc, nonemployeeCompensationForms: [...acc.nonemployeeCompensationForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.business_expenses\') { return { ...acc, businessExpenseForms: [...acc.businessExpenseForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.asset_register\') { return { ...acc, assetRegisters: [...acc.assetRegisters, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.rental_property\') { return { ...acc, rentalProperties: [...acc.rentalProperties, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.farm\') { return { ...acc, farmForms: [...acc.farmForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.adjustments\') { return { ...acc, adjustmentForms: [...acc.adjustmentForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1098e\') { return { ...acc, studentLoanInterestForms: [...acc.studentLoanInterestForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1098t\') { return { ...acc, tuitionForms: [...acc.tuitionForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.credits\') { return { ...acc, creditForms: [...acc.creditForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.ira\') { return { ...acc, iraForms: [...acc.iraForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.prior_year_ira_basis\') { return { ...acc, priorYearIraBasisForms: [...acc.priorYearIraBasisForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.form3921\') { return { ...acc, isoExerciseForms: [...acc.isoExerciseForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.form3922\') { return { ...acc, employeeStockPurchaseForms: [...acc.employeeStockPurchaseForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.basis_correction\') { return { ...acc, basisCorrectionForms: [...acc.basisCorrectionForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.k1_1065\') { return { ...acc, partnershipK1Forms: [...acc.partnershipK1Forms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.k1_1120s\') { return { ...acc, sCorporationK1Forms: [...acc.sCorporationK1Forms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.k1_1041\') { return { ...acc, estateTrustK1Forms: [...acc.estateTrustK1Forms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1095a\') { return { ...acc, marketplaceStatements: [...acc.marketplaceStatements, stored] } }',
    '        return undefined',
    '    }',
    '    const collect = documentHash => doc => acc => {',
    '        const routed = route(documentHash)(doc)(acc)',
    '        if (routed === undefined) {',
    '            return acc',
    '        }',
    '        return noteYearMismatch(documentHash)(doc)(routed)',
    '    }',
    '    const render = acc => {',
    '        if (acc.duplicateProfile) {',
    '            return {',
    '                kind: \'error\',',
    '                message: \'more than one active vnd.fjs.return_profile document; a return has exactly one filer\',',
    '                unmodeled: [],',
    '            }',
    '        }',
    '        const mismatch = acc.yearMismatch',
    '        if (mismatch !== undefined) {',
    '            return {',
    '                kind: \'error\',',
    '                message: \'document \' + mismatch.documentHash + \' (\' + mismatch.dialect',
    '                    + \') is stored for tax year \' + mismatch.taxYear',
    '                    + \', but this run computes tax year \' + runYear',
    '                    + \'; refusing rather than mixing tax years\',',
    '                unmodeled: [],',
    '            }',
    '        }',
    '        const profile = acc.profile',
    '        if (profile === undefined) {',
    '            return {',
    '                kind: \'error\',',
    '                message: \'no active vnd.fjs.return_profile document; a 1040 cannot be computed without one\',',
    '                unmodeled: [],',
    '            }',
    '        }',
    '        const outcome = ctx.form1040Report({',
    '            profile,',
    '            w2s: acc.w2s,',
    '            interestForms: acc.interestForms,',
    '            dividendForms: acc.dividendForms,',
    '            brokerageForms: acc.brokerageForms,',
    '            retirementForms: acc.retirementForms,',
    '            socialSecurityForms: acc.socialSecurityForms,',
    '            itemizedDeductionForms: acc.itemizedDeductionForms,',
    '            medicalExpenseForms: acc.medicalExpenseForms,',
    '            capitalLossCarryoverForms: acc.capitalLossCarryoverForms,',
    '            unemploymentForms: acc.unemploymentForms,',
    '            nonemployeeCompensationForms: acc.nonemployeeCompensationForms,',
    '            businessExpenseForms: acc.businessExpenseForms,',
    '            assetRegisters: acc.assetRegisters,',
    '            rentalProperties: acc.rentalProperties,',
    '            farmForms: acc.farmForms,',
    '            adjustmentForms: acc.adjustmentForms,',
    '            studentLoanInterestForms: acc.studentLoanInterestForms,',
    '            tuitionForms: acc.tuitionForms,',
    '            creditForms: acc.creditForms,',
    '            iraForms: acc.iraForms,',
    '            priorYearIraBasisForms: acc.priorYearIraBasisForms,',
    '            isoExerciseForms: acc.isoExerciseForms,',
    '            employeeStockPurchaseForms: acc.employeeStockPurchaseForms,',
    '            basisCorrectionForms: acc.basisCorrectionForms,',
    '            partnershipK1Forms: acc.partnershipK1Forms,',
    '            sCorporationK1Forms: acc.sCorporationK1Forms,',
    '            estateTrustK1Forms: acc.estateTrustK1Forms,',
    '            marketplaceStatements: acc.marketplaceStatements,',
    '        })',
    '        if (outcome.kind === \'error\') {',
    '            return { kind: \'error\', message: outcome.message, unmodeled: outcome.unmodeled }',
    '        }',
    '        return {',
    '            kind: \'ok\',',
    '            taxYear: profile.value.taxYear,',
    '            line16Method: outcome.line16Method,',
    '            qualifiedBusinessLossCarryforward: {',
    '                rule: outcome.qualifiedBusinessLossCarryforward.rule,',
    '                value: ctx.centsToString(outcome.qualifiedBusinessLossCarryforward.value),',
    '                sources: outcome.qualifiedBusinessLossCarryforward.sources,',
    '            },',
    '            lines: outcome.lines.map(line => ({',
    '                rule: line.rule,',
    '                value: ctx.centsToString(line.value),',
    '                sources: line.sources,',
    '            })),',
    '        }',
    '    }',
    '    const walk = subjects => acc => {',
    '        const subject = subjects[0]',
    '        if (subject === undefined) {',
    '            return ctx.pure(render(acc))',
    '        }',
    '        const rest = subjects.slice(1)',
    '        return ctx.step(ctx.evoHead(subject), headsJson => {',
    '            const heads = JSON.parse(headsJson)',
    '            const headHash = heads[0]',
    '            if (headHash === undefined) {',
    '                return walk(rest)(acc)',
    '            }',
    '            return ctx.step(ctx.evoRevision(headHash), revJson => {',
    '                const rev = JSON.parse(revJson)',
    '                return ctx.step(ctx.casRead(rev.snapshot), docJson => {',
    '                    const doc = JSON.parse(docJson)',
    '                    return walk(rest)(collect(rev.snapshot)(doc)(acc))',
    '                })',
    '            })',
    '        })',
    '    }',
    '    return walk(JSON.parse(activeJson).slice().sort())(empty)',
    '})',
    '',
].join('\n')

// ── The function twin ────────────────────────────────────────────────────────

/**
 * The starting accumulator — {@link taxReturnReportSource}'s own `empty`,
 * typed.
 * @type {Collected}
 */
const emptyCollected = {
    profile: undefined,
    duplicateProfile: false,
    yearMismatch: undefined,
    w2s: [],
    interestForms: [],
    dividendForms: [],
    brokerageForms: [],
    retirementForms: [],
    socialSecurityForms: [],
    itemizedDeductionForms: [],
    medicalExpenseForms: [],
    capitalLossCarryoverForms: [],
    unemploymentForms: [],
    nonemployeeCompensationForms: [],
    businessExpenseForms: [],
    assetRegisters: [],
    rentalProperties: [],
    farmForms: [],
    adjustmentForms: [],
    studentLoanInterestForms: [],
    tuitionForms: [],
    creditForms: [],
    iraForms: [],
    priorYearIraBasisForms: [],
    isoExerciseForms: [],
    employeeStockPurchaseForms: [],
    basisCorrectionForms: [],
    partnershipK1Forms: [],
    sCorporationK1Forms: [],
    estateTrustK1Forms: [],
    marketplaceStatements: [],
}

/**
 * Routes one parsed document into its `Form1040Inputs` field —
 * {@link taxReturnReportSource}'s own `collect`, typed.
 *
 * Written as an if-chain over the `dialect` discriminant rather than a
 * `{ dialect: fieldName }` lookup table, deliberately: the table form needs
 * a computed key (`{ ...acc, [field]: [...] }`), which no type can express
 * without discarding exactly the per-dialect element type
 * `Form1040Inputs` exists to guarantee. One explicit branch per dialect keeps
 * `tsc` checking that a 1099-R never lands in `w2s`, and the number of them is
 * NOT written here — `expectedDispatchedDialectCount` is where it lives,
 * because that one is asserted. This sentence said "thirteen" while the answer
 * was twenty-two.
 * Returns `undefined` — never `acc` — for a dialect the engine has no field
 * for, so {@link collectDocument} can tell "routed" apart from "skipped"
 * without comparing object identities that every spread would break.
 * @type {(documentHash: string) => (doc: EngineDocument) => (acc: Collected) => Collected | undefined}
 */
const routeDocument = documentHash => doc => acc => {
    if (doc.dialect === returnProfileDialect) {
        const stored = { documentHash, value: doc }
        return acc.profile === undefined
            ? { ...acc, profile: stored }
            : { ...acc, duplicateProfile: true }
    }
    if (doc.dialect === w2Dialect) { return { ...acc, w2s: [...acc.w2s, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineIntDialect) { return { ...acc, interestForms: [...acc.interestForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineDivDialect) { return { ...acc, dividendForms: [...acc.dividendForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineBDialect) { return { ...acc, brokerageForms: [...acc.brokerageForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineRDialect) { return { ...acc, retirementForms: [...acc.retirementForms, { documentHash, value: doc }] } }
    if (doc.dialect === ssa1099Dialect) { return { ...acc, socialSecurityForms: [...acc.socialSecurityForms, { documentHash, value: doc }] } }
    if (doc.dialect === itemizedDeductionsDialect) { return { ...acc, itemizedDeductionForms: [...acc.itemizedDeductionForms, { documentHash, value: doc }] } }
    if (doc.dialect === medicalExpensesDialect) { return { ...acc, medicalExpenseForms: [...acc.medicalExpenseForms, { documentHash, value: doc }] } }
    if (doc.dialect === priorYearCapitalLossDialect) { return { ...acc, capitalLossCarryoverForms: [...acc.capitalLossCarryoverForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineGDialect) { return { ...acc, unemploymentForms: [...acc.unemploymentForms, { documentHash, value: doc }] } }
    if (doc.dialect === adjustmentsDialect) { return { ...acc, adjustmentForms: [...acc.adjustmentForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineEightEDialect) { return { ...acc, studentLoanInterestForms: [...acc.studentLoanInterestForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineEightTDialect) { return { ...acc, tuitionForms: [...acc.tuitionForms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineNineNecDialect) { return { ...acc, nonemployeeCompensationForms: [...acc.nonemployeeCompensationForms, { documentHash, value: doc }] } }
    if (doc.dialect === businessExpensesDialect) { return { ...acc, businessExpenseForms: [...acc.businessExpenseForms, { documentHash, value: doc }] } }
    if (doc.dialect === assetRegisterDialect) { return { ...acc, assetRegisters: [...acc.assetRegisters, { documentHash, value: doc }] } }
    if (doc.dialect === rentalPropertyDialect) { return { ...acc, rentalProperties: [...acc.rentalProperties, { documentHash, value: doc }] } }
    if (doc.dialect === farmDialect) { return { ...acc, farmForms: [...acc.farmForms, { documentHash, value: doc }] } }
    if (doc.dialect === creditsDialect) { return { ...acc, creditForms: [...acc.creditForms, { documentHash, value: doc }] } }
    if (doc.dialect === iraDialect) { return { ...acc, iraForms: [...acc.iraForms, { documentHash, value: doc }] } }
    if (doc.dialect === priorYearIraBasisDialect) { return { ...acc, priorYearIraBasisForms: [...acc.priorYearIraBasisForms, { documentHash, value: doc }] } }
    if (doc.dialect === formThirtyNineTwentyOneDialect) { return { ...acc, isoExerciseForms: [...acc.isoExerciseForms, { documentHash, value: doc }] } }
    if (doc.dialect === formThirtyNineTwentyTwoDialect) { return { ...acc, employeeStockPurchaseForms: [...acc.employeeStockPurchaseForms, { documentHash, value: doc }] } }
    if (doc.dialect === basisCorrectionDialect) { return { ...acc, basisCorrectionForms: [...acc.basisCorrectionForms, { documentHash, value: doc }] } }
    if (doc.dialect === k1PartnershipDialect) { return { ...acc, partnershipK1Forms: [...acc.partnershipK1Forms, { documentHash, value: doc }] } }
    if (doc.dialect === k1SCorporationDialect) { return { ...acc, sCorporationK1Forms: [...acc.sCorporationK1Forms, { documentHash, value: doc }] } }
    if (doc.dialect === k1EstateTrustDialect) { return { ...acc, estateTrustK1Forms: [...acc.estateTrustK1Forms, { documentHash, value: doc }] } }
    if (doc.dialect === oneZeroNineFiveADialect) { return { ...acc, marketplaceStatements: [...acc.marketplaceStatements, { documentHash, value: doc }] } }
    return undefined
}

/**
 * Records the FIRST document whose stored tax year is not the year this run
 * computes — {@link taxReturnReportSource}'s own `noteYearMismatch`, typed.
 * See the module header for the whole rule and why refusing is not the same
 * decision as filtering.
 *
 * There are exactly TWO exemptions, both by name, and both for the identical
 * reason — the document records a PRIOR year by definition, so its year is
 * SUPPOSED to differ and refusing on it would make the fact unusable:
 *
 * - `vnd.fjs.prior_year_capital_loss` — a capital loss carryover
 *   (`fjs/document/prior_year_capital_loss`'s own docstring: its `taxYear`
 *   "names the PRIOR year these four figures come off").
 * - `vnd.fjs.prior_year_ira_basis` — Form 8606's line 2, which its
 *   instructions resolve to "the amount from line 14 of that Form 8606",
 *   meaning last year's (Phase 26, TAX-29).
 *
 * They are written as an explicit two-term disjunction rather than as a
 * membership test against a list, deliberately: two named constants a reader
 * can check against the two modules that declare them beats a collection that
 * could quietly grow. See the module header for why an exemption added
 * wrongly is the dangerous direction.
 *
 * The `typeof` guard is how "carries a `taxYear` field" is expressed as a
 * property of the DATA rather than as a list of dialects. Every dialect this
 * program routes declares `taxYear` as required today, so the guard is
 * unreachable for a validated document — but a rule written as "these ten
 * dialects" is precisely the shape that cannot see the eleventh, which is
 * the defect this codebase has shipped four times. Written as `typeof`
 * rather than `=== undefined` because `EngineDocument` types every member's
 * `taxYear` as `number`, and `tsc` rejects a comparison it believes can
 * never hold (TS2367) — the runtime possibility is real, the static type is
 * what is optimistic.
 * @type {(runYear: number) => (documentHash: string) => (doc: EngineDocument) => (acc: Collected) => Collected}
 */
const noteYearMismatch = runYear => documentHash => doc => acc => {
    if (acc.yearMismatch !== undefined) {
        return acc
    }
    if (doc.dialect === priorYearCapitalLossDialect || doc.dialect === priorYearIraBasisDialect) {
        return acc
    }
    const year = doc.taxYear
    if (typeof year !== 'number') {
        return acc
    }
    if (year === runYear) {
        return acc
    }
    return { ...acc, yearMismatch: { documentHash, dialect: doc.dialect, taxYear: year } }
}

/**
 * Routes one document and, if it was routed, checks its year —
 * {@link taxReturnReportSource}'s own `collect`, typed. A document the
 * engine has no field for is returned untouched and is NOT year-checked:
 * see the module header for why that narrowing is deliberate and where it is
 * pinned.
 * @type {(runYear: number) => (documentHash: string) => (doc: EngineDocument) => (acc: Collected) => Collected}
 */
const collectDocument = runYear => documentHash => doc => acc => {
    const routed = routeDocument(documentHash)(doc)(acc)
    if (routed === undefined) {
        return acc
    }
    return noteYearMismatch(runYear)(documentHash)(doc)(routed)
}

/**
 * Turns the collected document set into the wire result —
 * {@link taxReturnReportSource}'s own `render`, typed. The seventeen fields are
 * spelled out rather than spread, because `Collected` carries two members
 * `Form1040Inputs` does not (`duplicateProfile`, and a `profile` that may
 * still be `undefined`) and a spread would carry the first of those into the
 * engine's input.
 * @type {(ctx: Parameters<TaxReport<unknown>>[0]) => (acc: Collected) => TaxReturnResult}
 */
const renderReturn = ctx => acc => {
    if (acc.duplicateProfile) {
        return { kind: 'error', message: duplicateProfileMessage, unmodeled: [] }
    }
    const mismatch = acc.yearMismatch
    if (mismatch !== undefined) {
        return {
            kind: 'error',
            message: yearMismatchMessage(mismatch)(ctx.taxParams.taxYear),
            unmodeled: [],
        }
    }
    const profile = acc.profile
    if (profile === undefined) {
        return { kind: 'error', message: noProfileMessage, unmodeled: [] }
    }
    const outcome = ctx.form1040Report({
        profile,
        w2s: acc.w2s,
        interestForms: acc.interestForms,
        dividendForms: acc.dividendForms,
        brokerageForms: acc.brokerageForms,
        retirementForms: acc.retirementForms,
        socialSecurityForms: acc.socialSecurityForms,
        itemizedDeductionForms: acc.itemizedDeductionForms,
        medicalExpenseForms: acc.medicalExpenseForms,
        capitalLossCarryoverForms: acc.capitalLossCarryoverForms,
        unemploymentForms: acc.unemploymentForms,
        nonemployeeCompensationForms: acc.nonemployeeCompensationForms,
        businessExpenseForms: acc.businessExpenseForms,
        assetRegisters: acc.assetRegisters,
        rentalProperties: acc.rentalProperties,
        farmForms: acc.farmForms,
        adjustmentForms: acc.adjustmentForms,
        studentLoanInterestForms: acc.studentLoanInterestForms,
        tuitionForms: acc.tuitionForms,
        creditForms: acc.creditForms,
        iraForms: acc.iraForms,
        priorYearIraBasisForms: acc.priorYearIraBasisForms,
        isoExerciseForms: acc.isoExerciseForms,
        employeeStockPurchaseForms: acc.employeeStockPurchaseForms,
        basisCorrectionForms: acc.basisCorrectionForms,
        partnershipK1Forms: acc.partnershipK1Forms,
        sCorporationK1Forms: acc.sCorporationK1Forms,
        estateTrustK1Forms: acc.estateTrustK1Forms,
        marketplaceStatements: acc.marketplaceStatements,
    })
    if (outcome.kind === 'error') {
        return { kind: 'error', message: outcome.message, unmodeled: outcome.unmodeled }
    }
    return {
        kind: 'ok',
        taxYear: profile.value.taxYear,
        line16Method: outcome.line16Method,
        qualifiedBusinessLossCarryforward: {
            rule: outcome.qualifiedBusinessLossCarryforward.rule,
            value: ctx.centsToString(outcome.qualifiedBusinessLossCarryforward.value),
            sources: outcome.qualifiedBusinessLossCarryforward.sources,
        },
        lines: outcome.lines.map(line => ({
            rule: line.rule,
            value: ctx.centsToString(line.value),
            sources: line.sources,
        })),
    }
}

/**
 * The function twin of {@link taxReturnReportSource} — the IDENTICAL logic,
 * written as real JS rather than derived from the string (see the module
 * header for why neither is generated from the other).
 * @type {TaxReport<TaxReturnResult>}
 */
export const taxReturnReport = ctx => () => ctx.step(ctx.evoList('false'), activeJson => {
    /** @type {(subjects: readonly string[]) => (acc: Collected) => Effect<CasOp, TaxReturnResult, string>} */
    const walk = subjects => acc => {
        const subject = subjects[0]
        if (subject === undefined) {
            return ctx.pure(renderReturn(ctx)(acc))
        }
        const rest = subjects.slice(1)
        return ctx.step(ctx.evoHead(subject), headsJson => {
            /** @type {readonly string[]} */
            const heads = JSON.parse(headsJson)
            const headHash = heads[0]
            if (headHash === undefined) {
                return walk(rest)(acc)
            }
            return ctx.step(ctx.evoRevision(headHash), revJson => {
                /** @type {{ readonly snapshot: string }} */
                const rev = JSON.parse(revJson)
                return ctx.step(ctx.casRead(rev.snapshot), docJson => {
                    // The one cast of a `JSON.parse` result this program
                    // makes, and the same one `fjs/report/payer`'s twin
                    // makes: it types an `any`, it discards no `| undefined`
                    // (AGENTS.md). It is also never relied upon for a
                    // document outside the union — `collectDocument`'s
                    // dispatch reads only `.dialect`, and anything it does
                    // not recognize is returned untouched.
                    const doc = /** @type {EngineDocument} */ (JSON.parse(docJson))
                    return walk(rest)(collectDocument(ctx.taxParams.taxYear)(rev.snapshot)(doc)(acc))
                })
            })
        })
    }
    /** @type {readonly string[]} */
    const active = JSON.parse(activeJson)
    return walk(active.slice().sort())(emptyCollected)
})

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly once at module scope — the same
 * `assert` path `fjs/form1040/core` and `fjs/guest/tax` use, since
 * `noUncheckedIndexedAccess` makes the open year-keyed lookup yield
 * `TaxParamSet | undefined` and a cast or `!` is banned.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * The fixture return: a single filer, no dependents, TWO W-2s and ONE
 * 1099-G — the shape `.planning/phases/20-unemployment-compensation
 * /20-VERIFICATION.md` established when it ran the real transcript's shape
 * through the engine for the first time, split across two employers here so
 * the summing across documents is exercised rather than assumed.
 *
 * Every amount below is an INPUT. Not one expected value is derived from
 * them anywhere in this file — the expectations are hand-typed cents at the
 * assertion (AGENTS.md).
 */
const fixtureProfileHash = 'sha256-tax-return-profile'
const fixtureW2AHash = 'sha256-tax-return-w2-a'
const fixtureW2BHash = 'sha256-tax-return-w2-b'
const fixture1099GHash = 'sha256-tax-return-1099g'
const fixtureOutOfScopeHash = 'sha256-tax-return-out-of-scope'
// Phase 21's mixed-year fixtures. Each exists to move exactly one clause of
// the tax-year rule, so a leaf's failure localizes to the clause it tests.
const fixtureW2PriorYearHash = 'sha256-tax-return-w2-prior-year'
const fixtureProfilePriorYearHash = 'sha256-tax-return-profile-prior-year'
const fixtureCarryoverHash = 'sha256-tax-return-carryover'
const fixtureW2NoYearHash = 'sha256-tax-return-w2-no-year'
const fixtureOutOfScopePriorYearHash = 'sha256-tax-return-out-of-scope-prior-year'
const fixtureCreditsProfileHash = 'sha256-tax-return-credits-profile'
const fixtureCreditsW2Hash = 'sha256-tax-return-credits-w2'
const fixtureCreditsTuitionHash = 'sha256-tax-return-credits-1098t'
const fixtureCreditsRecordHash = 'sha256-tax-return-credits-record'
const fixtureCreditsProfileUndeclaredHash = 'sha256-tax-return-credits-profile-undeclared'
// Phase 26 (TAX-28/TAX-29): a retiree with a QCD and a nondeductible basis.
const fixtureRetireeProfileHash = 'sha256-tax-return-retiree-profile'
const fixtureRetiree1099RHash = 'sha256-tax-return-retiree-1099r'
const fixtureRetireeIraHash = 'sha256-tax-return-retiree-ira'
const fixtureRetireeBasisHash = 'sha256-tax-return-retiree-basis'
const fixtureRetireeProfileOnlyHash = 'sha256-tax-return-retiree-profile-only'
const fixtureFounderProfileHash = 'sha256-tax-return-founder-profile'
const fixtureFounderNecHash = 'sha256-tax-return-founder-1099nec'
const fixtureFounderExpensesHash = 'sha256-tax-return-founder-expenses'
const fixtureFounderRegisterHash = 'sha256-tax-return-founder-asset-register'
/** TAX-41's two: the SAME founder declaring `otherGainsOrLosses`, and a
 * register whose laptop was sold during the year. */
const fixtureFounderDisposalProfileHash = 'sha256-tax-return-founder-disposal-profile'
const fixtureFounderDisposalRegisterHash = 'sha256-tax-return-founder-disposal-register'
// TAX-39: the SAME business record with a Form 8829 half. A separate
// fixture rather than a field added to the one above, so the routing leaf
// that pins $260.00 of business income keeps pinning it.
const fixtureFounderHomeExpensesHash = 'sha256-tax-return-founder-home-expenses'
// The Schedule E Part I wiring's own two: a landlord.
const fixtureLandlordProfileHash = 'sha256-tax-return-landlord-profile'
const fixtureLandlordPropertyHash = 'sha256-tax-return-landlord-property'
// The Schedule F wiring's own two: a farmer.
const fixtureFarmerProfileHash = 'sha256-tax-return-farmer-profile'
const fixtureFarmerFarmHash = 'sha256-tax-return-farmer-farm'

/** The Form 461 phase's own document: the SAME farm with a losing year. */
const fixtureFarmerLossFarmHash = 'sha256-tax-return-farmer-loss-farm'
const fixtureMarketplaceProfileHash = 'sha256-tax-return-marketplace-profile'
const fixtureMarketplaceW2Hash = 'sha256-tax-return-marketplace-w2'
const fixtureMarketplaceStatementHash = 'sha256-tax-return-marketplace-1095a'
// TAX-42's own two: an expatriate on a U.S. payroll.
const fixtureExpatriateProfileHash = 'sha256-tax-return-expatriate-profile'
const fixtureExpatriateW2Hash = 'sha256-tax-return-expatriate-w2'
// ── The routing sweep's own documents ───────────────────────────────────
//
// TAX-37 closed the `vnd.fjs.1095a` hole one dialect at a time and said so:
// "the same hole is still open for the other twenty-five dispatched
// dialects". A mutation sweep over every branch of {@link routeDocument} —
// deleting one line at a time and running `npm test` — priced it: FIFTEEN of
// the twenty-six branches could be deleted with the ENTIRE suite green.
// These fixtures are what closes the fifteen.
//
// Four personas, not one, and the split is load-bearing rather than tidy:
// `capitalGainsOrLosses` turns Schedule D on and changes what line 7a means,
// `itemizeEvenThoughLessThanStandardDeduction` changes what line 12e means,
// and `alternativeMinimumTax` is the one declaration a stored Form 3921
// REQUIRES (its tripwire fires on the document's mere presence). A single
// profile carrying all of them would make every leaf below depend on
// declarations it is not about.
const fixtureSweepProfileHash = 'sha256-tax-return-sweep-profile'
const fixtureSweepInterestHash = 'sha256-tax-return-sweep-1099int'
const fixtureSweepDividendHash = 'sha256-tax-return-sweep-1099div'
const fixtureSweepSocialSecurityHash = 'sha256-tax-return-sweep-ssa1099'
// The unread-field sweep's own two: a 1099-DIV carrying ONLY the two boxes
// nothing read, and an SSA-1099 carrying its box 6 alongside box 5.
const fixtureSweepExemptDividendHash = 'sha256-tax-return-sweep-1099div-exempt'
const fixtureSweepSocialSecurityWithholdingHash = 'sha256-tax-return-sweep-ssa1099-w4v'
const fixtureSweepPartnershipK1Hash = 'sha256-tax-return-sweep-k1-1065'
const fixtureSweepSCorporationK1Hash = 'sha256-tax-return-sweep-k1-1120s'
const fixtureSweepEstateTrustK1Hash = 'sha256-tax-return-sweep-k1-1041'
const fixtureSweepGainsProfileHash = 'sha256-tax-return-sweep-gains-profile'
const fixtureSweepBrokerageHash = 'sha256-tax-return-sweep-1099b'
/** TAX-38: a section 1256 Form 1099-B — boxes 8 through 11, no box 1 sale at all. */
const fixtureSweepSectionTwelveFiftySixHash = 'sha256-tax-return-sweep-1099b-1256'
const fixtureSweepRealCarryoverHash = 'sha256-tax-return-sweep-carryover'
const fixtureSweepCorrectedBrokerageHash = 'sha256-tax-return-sweep-1099b-corrected'
const fixtureSweepBasisCorrectionHash = 'sha256-tax-return-sweep-basis-correction'
const fixtureSweepEsppHash = 'sha256-tax-return-sweep-form3922'
const fixtureSweepDeductionProfileHash = 'sha256-tax-return-sweep-deduction-profile'
const fixtureSweepItemizedHash = 'sha256-tax-return-sweep-itemized'
const fixtureSweepMedicalHash = 'sha256-tax-return-sweep-medical'
const fixtureSweepAdjustmentProfileHash = 'sha256-tax-return-sweep-adjustment-profile'
const fixtureSweepAdjustmentsHash = 'sha256-tax-return-sweep-adjustments'
const fixtureHealthProfileHash = 'sha256-tax-return-7206-profile'
const fixtureHealthNecHash = 'sha256-tax-return-7206-1099nec'
const fixtureHealthBusinessHash = 'sha256-tax-return-7206-business'
const fixtureHealthAdjustmentsHash = 'sha256-tax-return-7206-adjustments'
const fixtureSweepStudentLoanHash = 'sha256-tax-return-sweep-1098e'
const fixtureSweepIsoProfileHash = 'sha256-tax-return-sweep-iso-profile'
const fixtureSweepIsoHash = 'sha256-tax-return-sweep-form3921'

const subjectProfile = 'tax-return-subject-profile'
const subjectW2A = 'tax-return-subject-w2-a'
const subjectW2B = 'tax-return-subject-w2-b'
const subject1099G = 'tax-return-subject-1099g'
const subjectOutOfScope = 'tax-return-subject-out-of-scope'
const subjectW2PriorYear = 'tax-return-subject-w2-prior-year'
const subjectProfilePriorYear = 'tax-return-subject-profile-prior-year'
const subjectCarryover = 'tax-return-subject-carryover'
const subjectW2NoYear = 'tax-return-subject-w2-no-year'
const subjectOutOfScopePriorYear = 'tax-return-subject-out-of-scope-prior-year'
// Phase 25 (TAX-25/TAX-26): a SEPARATE subject set, so the phase-21 fixture
// above keeps computing byte for byte what it always has.
const subjectCreditsProfile = 'tax-return-subject-credits-profile'
const subjectCreditsW2 = 'tax-return-subject-credits-w2'
const subjectCreditsTuition = 'tax-return-subject-credits-1098t'
const subjectCreditsRecord = 'tax-return-subject-credits-record'
const subjectCreditsProfileUndeclared = 'tax-return-subject-credits-profile-undeclared'
// Phase 26 (TAX-28/TAX-29): a THIRD separate subject set, for the same reason
// Phase 25 took a second one — so both earlier fixtures keep computing byte
// for byte what they always have.
const subjectRetireeProfile = 'tax-return-subject-retiree-profile'
const subjectRetiree1099R = 'tax-return-subject-retiree-1099r'
const subjectRetireeIra = 'tax-return-subject-retiree-ira'
const subjectRetireeBasis = 'tax-return-subject-retiree-basis'
const subjectRetireeProfileOnly = 'tax-return-subject-retiree-profile-only'
const subjectFounderProfile = 'tax-return-subject-founder-profile'
const subjectFounderNec = 'tax-return-subject-founder-1099nec'
const subjectFounderExpenses = 'tax-return-subject-founder-expenses'
const subjectFounderRegister = 'tax-return-subject-founder-asset-register'
const subjectFounderDisposalProfile = 'tax-return-subject-founder-disposal-profile'
const subjectFounderDisposalRegister = 'tax-return-subject-founder-disposal-register'
const subjectFounderHomeExpenses = 'tax-return-subject-founder-home-expenses'
const subjectLandlordProfile = 'tax-return-subject-landlord-profile'
const subjectLandlordProperty = 'tax-return-subject-landlord-property'
const subjectFarmerProfile = 'tax-return-subject-farmer-profile'
const subjectFarmerFarm = 'tax-return-subject-farmer-farm'
const subjectFarmerLossFarm = 'tax-return-subject-farmer-loss-farm'
const subjectMarketplaceProfile = 'tax-return-subject-marketplace-profile'
const subjectExpatriateProfile = 'tax-return-subject-expatriate-profile'
const subjectExpatriateW2 = 'tax-return-subject-expatriate-w2'
const subjectMarketplaceW2 = 'tax-return-subject-marketplace-w2'
const subjectMarketplaceStatement = 'tax-return-subject-marketplace-1095a'
// The routing sweep's own subjects, one per document above.
const subjectSweepProfile = 'tax-return-subject-sweep-profile'
const subjectSweepInterest = 'tax-return-subject-sweep-1099int'
const subjectSweepDividend = 'tax-return-subject-sweep-1099div'
const subjectSweepSocialSecurity = 'tax-return-subject-sweep-ssa1099'
const subjectSweepExemptDividend = 'tax-return-subject-sweep-1099div-exempt'
const subjectSweepSocialSecurityWithholding = 'tax-return-subject-sweep-ssa1099-w4v'
const subjectSweepPartnershipK1 = 'tax-return-subject-sweep-k1-1065'
const subjectSweepSCorporationK1 = 'tax-return-subject-sweep-k1-1120s'
const subjectSweepEstateTrustK1 = 'tax-return-subject-sweep-k1-1041'
const subjectSweepGainsProfile = 'tax-return-subject-sweep-gains-profile'
const subjectSweepBrokerage = 'tax-return-subject-sweep-1099b'
/** The Evo subject naming {@link fixtureSweepSectionTwelveFiftySixHash}. */
const subjectSweepSectionTwelveFiftySix = 'tax-return-subject-sweep-1099b-1256'
const subjectSweepRealCarryover = 'tax-return-subject-sweep-carryover'
const subjectSweepCorrectedBrokerage = 'tax-return-subject-sweep-1099b-corrected'
const subjectSweepBasisCorrection = 'tax-return-subject-sweep-basis-correction'
const subjectSweepEspp = 'tax-return-subject-sweep-form3922'
const subjectSweepDeductionProfile = 'tax-return-subject-sweep-deduction-profile'
const subjectSweepItemized = 'tax-return-subject-sweep-itemized'
const subjectSweepMedical = 'tax-return-subject-sweep-medical'
const subjectSweepAdjustmentProfile = 'tax-return-subject-sweep-adjustment-profile'
const subjectSweepAdjustments = 'tax-return-subject-sweep-adjustments'
const subjectSweepStudentLoan = 'tax-return-subject-sweep-1098e'
const subjectSweepIsoProfile = 'tax-return-subject-sweep-iso-profile'
const subjectSweepIso = 'tax-return-subject-sweep-form3921'

// TAX-39's own four subjects — the §162(l) persona. A sole proprietor needs a
// profile, a Form 1099-NEC, a `vnd.fjs.business_expenses` record (Schedule C
// refuses without one) and the `vnd.fjs.adjustments` record carrying the
// premium.
const subjectHealthProfile = 'tax-return-subject-7206-profile'
const subjectHealthNec = 'tax-return-subject-7206-1099nec'
const subjectHealthBusiness = 'tax-return-subject-7206-business'
const subjectHealthAdjustments = 'tax-return-subject-7206-adjustments'

/** @type {Readonly<Record<string, EngineDocument | { readonly dialect: string, readonly taxYear?: number }>>} */
const documentByHash = {
    [fixtureProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'wages',
            'unemploymentCompensation',
            'federalTaxWithheldOnW2',
            'federalTaxWithheldOnOther1099',
        ],
    },
    [fixtureW2AHash]: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-A',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation: '35937.00',
        box2FederalIncomeTaxWithheld: '6384.00',
    },
    [fixtureW2BHash]: {
        dialect: w2Dialect,
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-B',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation: '9568.00',
        box2FederalIncomeTaxWithheld: '2578.00',
    },
    [fixture1099GHash]: {
        dialect: oneZeroNineNineGDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-1099G',
        taxYear: 2025,
        formRevision: '2025',
        box1UnemploymentCompensation: '4554.00',
        box4FederalIncomeTaxWithheld: '454.00',
    },
    // A dialect the engine has no bucket for. Present so the fall-through
    // arm of `collectDocument` is genuinely EXERCISED rather than merely
    // written: without it, deleting that arm's `return acc` would be
    // unobservable.
    [fixtureOutOfScopeHash]: {
        dialect: 'vnd.fjs.ocr',
    },
    // A W-2 for the WRONG year, carrying wages large enough that a return
    // computed with it could not be mistaken for the fixture's own — so a
    // leaf asserting the refusal cannot pass because the number happened to
    // coincide.
    [fixtureW2PriorYearHash]: {
        dialect: w2Dialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-PRIOR',
        taxYear: 2024,
        formRevision: '2024',
        box1WagesTipsOtherCompensation: '80000.00',
    },
    // The PROFILE for the wrong year. PROV-04 makes the caller's `taxYear`
    // authoritative, so this is a mismatch like any other rather than a
    // redefinition of what the run's year is.
    [fixtureProfilePriorYearHash]: {
        dialect: returnProfileDialect,
        taxYear: 2024,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'wages',
            'unemploymentCompensation',
            'federalTaxWithheldOnW2',
            'federalTaxWithheldOnOther1099',
        ],
    },
    // The ONE exemption: a capital loss carryover records a PRIOR year by
    // definition, so its 2024 must NOT refuse a 2025 run.
    [fixtureCarryoverHash]: {
        dialect: priorYearCapitalLossDialect,
        recipientTin: '222-22-2222',
        taxYear: 2024,
        priorYearFormLine15: '0.00',
        priorYearScheduleDLine7: '0.00',
        priorYearScheduleDLine15: '0.00',
        priorYearScheduleDLine21: '0.00',
    },
    // A routed dialect carrying NO year at all. Impossible for a validated
    // document — every routed dialect declares `taxYear` as required — but
    // the rule is "if it carries a year", so the branch that says so is
    // exercised here rather than left as unproven defensive code. No money
    // box, so it contributes nothing to any hand-typed figure.
    [fixtureW2NoYearHash]: {
        dialect: w2Dialect,
        payerTin: '77-7777777',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-NO-YEAR',
        formRevision: '2025',
    },
    // An UNROUTED dialect for the wrong year: pins the deliberate narrowing
    // (see the module header) that a document the engine never sees cannot
    // block a return.
    [fixtureOutOfScopePriorYearHash]: {
        dialect: 'vnd.fjs.ocr',
        taxYear: 2024,
    },
    // ── Phase 25's own four documents ──────────────────────────────────
    //
    // The identical return `fjs/form1040/core`'s own `scheduleThreeCredits`
    // block computes directly, presented here through the STORED PROGRAM
    // instead — which is what proves the two new dialects are routed by the
    // guest source text rather than only by the host twin. Without a fixture
    // that carries them, the two new `route` branches could be deleted and
    // nothing would notice, which is the Phase 24 lesson exactly.
    [fixtureCreditsProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'wages', 'educationCredits', 'retirementSavingsContributionsCredit',
            'americanOpportunityCredit',
        ],
    },
    [fixtureCreditsW2Hash]: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-C',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation: '39000.00',
        box12: [{ code: 'DD', amount: '9800.00' }, { code: 'D', amount: '2000.00' }],
    },
    [fixtureCreditsTuitionHash]: {
        dialect: oneZeroNineEightTDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'STU-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1PaymentsReceivedForQualifiedTuition: '9000.00',
        box8AtLeastHalfTimeStudent: true,
    },
    [fixtureCreditsRecordHash]: {
        dialect: creditsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        educationStudents: [{
            studentTin: '222-22-2222',
            studentName: 'the filer',
            credit: 'americanOpportunity',
            enrolledAtLeastHalfTimeInADegreeProgram: true,
        }],
        filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true,
        saversCreditEligibility: [{
            individual: 'taxpayer',
            attainedAgeEighteen: true,
            noTestingPeriodDistributions: true,
        }],
    },
    // The same filer declaring nothing but wages — the return this engine
    // computed for a 401(k) contributor before Phase 25, and still does.
    [fixtureCreditsProfileUndeclaredHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['wages'],
    },
    // ── Phase 26's own five documents (TAX-28/TAX-29) ───────────────────
    //
    // A 65-or-older retiree with one IRA: $50,000 distributed, $20,000 of it
    // given straight to a food bank, $20,000 of prior-year nondeductible
    // basis, and $150,000 of aggregated traditional IRAs left at 31 December.
    // A separate subject set, so every figure Phases 21 and 25 pinned keeps
    // computing byte for byte what it always has.
    [fixtureRetireeProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        taxpayerBornBeforeJan2_1961: true,
        declaredKinds: ['iraDistributions', 'seniorAndOtherScheduleOneADeductions'],
    },
    [fixtureRetiree1099RHash]: {
        dialect: oneZeroNineNineRDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-IRA',
        taxYear: 2025,
        formRevision: '2025',
        box1GrossDistribution: '50000.00',
        box2aTaxableAmount: '50000.00',
        // What a custodian actually checks on a traditional IRA, and the
        // reason a QCD cannot be read off the document: the payer does not
        // know what the taxpayer did with the money.
        box2bTaxableAmountNotDetermined: true,
        box7bIraSepSimple: true,
    },
    [fixtureRetireeIraHash]: {
        dialect: iraDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
        qualifiedCharitableDistributions: [{
            payerTin: '66-6666666',
            accountNumber: 'ACC-IRA',
            charity: 'Riverside Food Bank',
            amount: '20000.00',
        }],
        yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
    },
    // The PRIOR-year document, and the second exemption from the mixed-year
    // refusal: its 2024 must not refuse a 2025 run.
    [fixtureRetireeBasisHash]: {
        dialect: priorYearIraBasisDialect,
        recipientTin: '222-22-2222',
        taxYear: 2024,
        priorYearForm8606Line14: '20000.00',
    },
    // The same retiree with neither election nor basis — the return this
    // engine computed before Phase 26, and the control that prices what it
    // was silently overstating.
    [fixtureRetireeProfileOnlyHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        taxpayerBornBeforeJan2_1961: true,
        declaredKinds: ['iraDistributions', 'seniorAndOtherScheduleOneADeductions'],
    },
    // ── Phase 27's own three documents (DOC-20/DOC-21/TAX-30) ───────────
    //
    // The startup founder, at the only scale this engine can put on a 1040
    // until Phase 28 supplies Schedule SE: §1402(b)(2) exempts net earnings
    // from self-employment below $400, and `fjs/schedule/c` refuses anything
    // at or above it rather than emitting a return with Schedule 2 line 4 at
    // zero. See that module's own docstring.
    //
    // Without these three fixtures the two new `route` branches could be
    // deleted and nothing would notice — the Phase 24 lesson, restated by
    // Phases 25 and 26 and followed here.
    [fixtureFounderProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['businessIncomeOrLoss', 'federalTaxWithheldOnOther1099'],
    },
    [fixtureFounderNecHash]: {
        dialect: oneZeroNineNineNecDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'CLIENT-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1NonemployeeCompensation: '350.00',
        box4FederalIncomeTaxWithheld: '40.00',
    },
    // ── TAX-37's own three documents: the ACA-marketplace enrollee ──────
    //
    // Added because a mutation proved they were needed. Deleting the twin's
    // `vnd.fjs.1095a` route branch left the ENTIRE suite green — 2,568
    // proofs, including every one of `fjs/form1040/core`'s own end-to-end
    // premium-tax-credit leaves, because those hand the engine a
    // `Form1040Inputs` directly and never travel through this program's
    // document routing. That is the Phase 24 lesson this file's own founder
    // block records, arriving for the eighth time.
    //
    // **[CLOSED] The same hole was still open for the other twenty-five
    // dispatched dialects when this paragraph was written**, and it said so
    // rather than closing it: `sourceAndTwinDispatchOnTheSameTwentyNineDialects`
    // (named `…TwentyEight…` while it was written, before `vnd.fjs.farm`)
    // greps the SOURCE text for each tag and asserts nothing at all about the
    // TWIN's branch, so any route branch whose dialect had no fixture in this
    // file could be deleted silently. The sweep it asked for is
    // {@link proof.routingSweep}, and it measured the hole before closing it:
    // fifteen of the twenty-six branches were deletable with the whole suite
    // green. Every one of the twenty-six now reddens at least one leaf.
    [fixtureMarketplaceProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['wages', 'federalTaxWithheldOnW2', 'netPremiumTaxCredit'],
        federalPovertyLineTable: 'contiguous48AndDistrictOfColumbia',
    },
    // TAX-42. **NOTHING new is routed here**, and that is the finding worth
    // recording rather than a missing branch: Form 2555's five facts ride on
    // `vnd.fjs.return_profile`, which {@link routeDocument} has dispatched
    // since Phase 21. There is no information return for foreign earned
    // income anywhere, so the guest program needed no edit at all — and this
    // fixture exists to prove the whole chain still runs end to end through
    // the stored program, which is the one place a profile field that never
    // reached `Form1040Inputs` would show.
    [fixtureExpatriateProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['wages', 'federalTaxWithheldOnW2', 'foreignEarnedIncomeExclusion'],
        physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
        foreignEarnedIncomeQualifyingDays: 365,
        foreignEarnedIncome: '60000.00',
    },
    [fixtureExpatriateW2Hash]: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-2555',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation: '90000.00',
        box2FederalIncomeTaxWithheld: '9000.00',
    },
    [fixtureMarketplaceW2Hash]: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2-ACA',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation: '30000.00',
        box2FederalIncomeTaxWithheld: '2000.00',
    },
    [fixtureMarketplaceStatementHash]: {
        dialect: oneZeroNineFiveADialect,
        marketplaceIdentifier: '99',
        marketplaceAssignedPolicyNumber: 'POLICY-TWIN-0001',
        policyIssuerName: 'Some Health Plan, Inc.',
        recipientSsn: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        coveredIndividuals: [{ name: 'Some Person' }],
        monthlyCoverage: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => ({
            month,
            columnAEnrollmentPremiums: '800.00',
            columnBSlcspPremium: '850.00',
            columnCAdvancePaymentOfPtc: '400.00',
        })),
    },
    [fixtureFounderExpensesHash]: {
        dialect: businessExpensesDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        // Phase 28 (TAX-32): "0.00" is the ASSERTION that there was no
        // prior-year qualified business loss, and it is a different statement
        // from the field being absent -- `fjs/form8995` refuses an absent one
        // rather than reading it as none.
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [{
            category: 'advertising',
            datePaid: '2025-03-14',
            description: 'search advertising',
            amount: '90.00',
        }],
    },
    // TAX-39. **The Form 8829 record rides inside `vnd.fjs.business_expenses`,
    // and this fixture is the evidence for the design decision that put it
    // there**: no new dialect means no new `routeDocument` branch, so the
    // stored program below reaches Schedule C line 30 through a route that
    // already existed and that {@link
    // proof.sourceAndTwinDispatchOnTheSameNineteenDialects} already pins.
    //
    // Sized so the gross income limitation does NOT bind at this persona's
    // $260.00 of tentative profit, which is what makes the return computable
    // at all — 100 square feet of a 1,000-square-foot home is 10%:
    //
    //   line 24  $1,200.00 of utilities x 10%            =  $120.00
    //   line 26  = line 27, and $120.00 <= $260.00 of line 15
    //   line 28  260.00 - 120.00                         =  $140.00
    //   line 40  ($50,000.00 - $10,000.00) x 10%         = $4,000.00
    //   line 42  $4,000.00 x 2.564%                      =  $102.56  <= $140.00
    //   line 36  120.00 + 102.56                         =  $222.56
    [fixtureFounderHomeExpensesHash]: {
        dialect: businessExpensesDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [{
            category: 'advertising',
            datePaid: '2025-03-14',
            description: 'search advertising',
            amount: '90.00',
        }],
        businessUseOfHome: {
            method: 'actualExpenses',
            claimingTheStandardDeduction: true,
            allGrossIncomeFromTheBusinessUseOfTheHome: true,
            areaUsedForBusiness: 100,
            totalAreaOfHome: 1000,
            expenses: [{
                line: '21',
                column: 'indirect',
                description: 'utilities',
                amount: '1200.00',
            }],
            homeAdjustedBasisOrFairMarketValue: '50000.00',
            landIncludedInThatBasis: '10000.00',
            firstUsedForBusiness: '2019-06',
        },
    },
    // ── The routing sweep's own twenty-three documents ──────────────────
    //
    // Persona 1: the portfolio filer. Every document below lands on a line
    // that needs NO declaration to be computed (`declaredKinds` gates
    // whole-return refusals, not individual modeled lines), so the four
    // amounts are deliberately DIFFERENT — a 1099-INT misrouted into a K-1
    // bucket, or a K-1 into the 1099-INT's, would print the wrong figure
    // rather than the right one by coincidence.
    [fixtureSweepProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'taxableInterest', 'ordinaryDividends', 'qualifiedDividends',
            'socialSecurityBenefits',
        ],
    },
    [fixtureSweepInterestHash]: {
        dialect: oneZeroNineNineIntDialect,
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-INT',
        taxYear: 2025,
        formRevision: '2025',
        box1InterestIncome: '5000.00',
    },
    [fixtureSweepDividendHash]: {
        dialect: oneZeroNineNineDivDialect,
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-DIV',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1aTotalOrdinaryDividends: '1000.00',
        box1bQualifiedDividends: '400.00',
    },
    // `payerTin: ''` is the dialect's own deliberate deviation — an SSA-1099
    // prints no payer TIN, and a non-empty one is refused.
    [fixtureSweepSocialSecurityHash]: {
        dialect: ssa1099Dialect,
        payerTin: '',
        recipientTin: '222-22-2222',
        accountNumber: 'CLAIM-SWEEP',
        taxYear: 2025,
        formRevision: '2025',
        box5NetBenefits: '12000.00',
    },
    // The unread-field sweep's own 1099-DIV: boxes 12 and 13, and NO box 1a or
    // 1b, so the leaf that reads it cannot be satisfied by the ordinary
    // dividend routing that `fixtureSweepDividendHash` already covers. The two
    // amounts differ from each other and from every other figure in this map,
    // so a misrouted box prints the wrong number rather than the right one by
    // coincidence.
    [fixtureSweepExemptDividendHash]: {
        dialect: oneZeroNineNineDivDialect,
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-DIV-EXEMPT',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box12ExemptInterestDividends: '3300.00',
        box13SpecifiedPrivateActivityBondInterestDividends: '700.00',
    },
    // The unread-field sweep's own SSA-1099: the same shape as the one above
    // it plus box 6, the voluntary Form W-4V withholding that reaches 1040 line
    // 25b. Benefits are $9,000.00 rather than $12,000.00 so the two SSA
    // fixtures cannot be confused for one another in a rendered line.
    [fixtureSweepSocialSecurityWithholdingHash]: {
        dialect: ssa1099Dialect,
        payerTin: '',
        recipientTin: '222-22-2222',
        accountNumber: 'CLAIM-SWEEP-W4V',
        taxYear: 2025,
        formRevision: '2025',
        box5NetBenefits: '9000.00',
        box6VoluntaryFederalIncomeTaxWithheld: '810.00',
    },
    // The three K-1 faces, each carrying interest AND NOTHING ELSE. Their
    // interest boxes are numbered 5, 4 and 1 on the three printed faces —
    // the collision DOC-24's separate dialects exist to prevent — and the
    // ordinary-business-income boxes are deliberately absent, because those
    // trip `fjs/return/tripwire`'s undeclared-kind refusals and would make
    // each leaf a proof about a declaration rather than about routing.
    [fixtureSweepPartnershipK1Hash]: {
        dialect: k1PartnershipDialect,
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'PTR-SWEEP',
        taxYear: 2025,
        formRevision: '2025',
        boxGGeneralPartnerOrLlcMemberManager: true,
        materialParticipation: 'materiallyParticipated',
        box5InterestIncome: '700.00',
    },
    [fixtureSweepSCorporationK1Hash]: {
        dialect: k1SCorporationDialect,
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'SHR-SWEEP',
        taxYear: 2025,
        formRevision: '2025',
        materialParticipation: 'materiallyParticipated',
        box4InterestIncome: '30.00',
    },
    // No `accountNumber`: the Schedule K-1 (Form 1041) face has no such box.
    [fixtureSweepEstateTrustK1Hash]: {
        dialect: k1EstateTrustDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        boxHDomesticBeneficiary: true,
        materialParticipation: 'materiallyParticipated',
        box1InterestIncome: '400.00',
    },
    // Persona 2: the investor who declares capital gains. `filingScheduleD`
    // is read VERBATIM off this declaration and never off document
    // presence, so without it a stored 1099-B, a stored carryover and a
    // stored basis correction are each dropped in a different way.
    [fixtureSweepGainsProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['capitalGainsOrLosses'],
    },
    [fixtureSweepBrokerageHash]: {
        dialect: oneZeroNineNineBDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-B',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1aDescriptionOfProperty: '100 sh SOMECO',
        box1dProceeds: '5000.00',
        box1eCostOrOtherBasis: '3000.00',
        box2ShortTermGainOrLoss: true,
    },
    // TAX-38: the SAME dialect, carrying the section 1256 block instead of a
    // box 1 sale. Boxes 1a through 1e are absent, which is what the printed
    // form guarantees — box 1d "does not include proceeds from regulated
    // futures contracts or Section 1256 option contracts", and box 1c prints
    // nothing "for aggregate reporting in boxes 8 through 11".
    //
    //   box 8 - box 9 + box 10 = 40,000 - 6,000 + 9,000 = 43,000 = box 11
    [fixtureSweepSectionTwelveFiftySixHash]: {
        dialect: oneZeroNineNineBDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-1256',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box8ProfitOrLossRealized: '40000.00',
        box9UnrealizedProfitOrLossPriorYearEnd: '6000.00',
        box10UnrealizedProfitOrLossCurrentYearEnd: '9000.00',
        box11AggregateProfitOrLoss: '43000.00',
    },
    // A carryover with REAL figures. The Phase 21 fixture above carries four
    // zeros — it proves the year exemption and nothing else, which is why
    // deleting this dialect's route branch left the whole suite green.
    [fixtureSweepRealCarryoverHash]: {
        dialect: priorYearCapitalLossDialect,
        recipientTin: '222-22-2222',
        taxYear: 2024,
        priorYearFormLine15: '20000.00',
        priorYearScheduleDLine7: '-10000.00',
        priorYearScheduleDLine15: '1000.00',
        priorYearScheduleDLine21: '-3000.00',
    },
    // The RSU pair: a broker who reported $0.00 of basis because that is
    // what the employee paid, and the correction that says the whole
    // proceeds figure is already inside Form W-2 box 1.
    [fixtureSweepCorrectedBrokerageHash]: {
        dialect: oneZeroNineNineBDialect,
        payerTin: '77-7777777',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-RSU',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1aDescriptionOfProperty: '40 sh MEGACORP',
        box1dProceeds: '6000.00',
        box1eCostOrOtherBasis: '0.00',
        box2ShortTermGainOrLoss: true,
        box12BasisReportedToIrs: true,
    },
    [fixtureSweepBasisCorrectionHash]: {
        dialect: basisCorrectionDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        brokerageDocumentHash: fixtureSweepCorrectedBrokerageHash,
        correctedCostOrOtherBasis: '6000.00',
        reason: '40 restricted stock units vested at $150.00 and the whole $6,000.00 is '
            + 'inside Form W-2 box 1; the broker reported $0.00 because that is what the '
            + 'employee paid.',
    },
    // Form 3922 is the one dispatched dialect with NO figure of its own on
    // any printed line: its only reader is a refusal. See the leaf.
    [fixtureSweepEsppHash]: {
        dialect: formThirtyNineTwentyTwoDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-ESPP',
        taxYear: 2025,
        formRevision: 'April 2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1DateOptionGranted: '01/01/2025',
        box2DateOptionExercised: '06/30/2025',
        box3FairMarketValuePerShareOnGrantDate: '100.00',
        box4FairMarketValuePerShareOnExerciseDate: '150.00',
        box5ExercisePricePaidPerShare: '85.00',
        box6NumberOfSharesTransferred: '100',
        box7DateLegalTitleTransferred: '06/30/2025',
        box8ExercisePricePerShareAsIfExercisedOnGrantDate: '85.00',
    },
    // Persona 3: the itemizer, with NO income document at all. That is what
    // makes both deduction dialects observable in one figure each — §213's
    // 7.5%-of-AGI medical floor is 7.5% of nothing here, so the medical
    // document's own amount survives to Schedule A line 4 intact.
    //
    // `itemizeEvenThoughLessThanStandardDeduction` is the line 18 election.
    // Without it `deductionChoice` takes the $15,750.00 standard deduction
    // and BOTH documents become invisible — which is not a routing fact and
    // would make these leaves prove the wrong thing.
    [fixtureSweepDeductionProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['itemizedDeductions'],
        itemizeEvenThoughLessThanStandardDeduction: true,
    },
    [fixtureSweepItemizedHash]: {
        dialect: itemizedDeductionsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [{
            lineTag: 'saltIncomeTax',
            provider: 'State of California',
            amount: '4200.00',
        }],
    },
    [fixtureSweepMedicalHash]: {
        dialect: medicalExpensesDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [{
            datePaid: '2025-03-01',
            provider: 'Some Hospital',
            category: 'medical',
            amount: '1000.00',
        }],
    },
    // Persona 4: the filer with two above-the-line adjustments and nothing
    // else. Both reach 1040 line 10 through Schedule 1 Part II, which is why
    // they share a profile and are asserted one document at a time.
    [fixtureSweepAdjustmentProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['educatorExpenses', 'studentLoanInterestDeduction'],
    },
    [fixtureSweepAdjustmentsHash]: {
        dialect: adjustmentsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [{
            lineTag: 'educatorExpenses',
            datePaid: '2025-09-02',
            description: 'classroom supplies',
            amount: '300.00',
            individual: 'taxpayer',
        }],
    },
    [fixtureSweepStudentLoanHash]: {
        dialect: oneZeroNineEightEDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'LOAN-SWEEP',
        taxYear: 2025,
        formRevision: '2025',
        box1StudentLoanInterestReceived: '1000.00',
    },
    // Persona 8 (TAX-39): the self-employed filer who paid for their own
    // health coverage. Four stored documents, and the deduction reaches 1040
    // line 10 only if every one of them is routed, read and combined — which
    // is what no form-level or schedule-level proof can show.
    [fixtureHealthProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'businessIncomeOrLoss', 'selfEmploymentTax', 'deductiblePartOfSelfEmploymentTax',
            'qualifiedBusinessIncomeDeduction', 'selfEmployedHealthInsuranceDeduction',
        ],
        // §162(l)(2)(B). Without it `fjs/schedule/1` refuses the whole return;
        // that side is driven by `fjs/form1040/core`'s
        // `theUncertifiedSelfEmployedReturnRefusesTheWholeReport`, which reaches
        // the same refusal through the same schedule. Named here rather than
        // duplicated, because a second profile document on this fixture would
        // be a second copy of the same assertion.
        notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth: true,
    },
    [fixtureHealthNecHash]: {
        dialect: oneZeroNineNineNecDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'CLIENT-7206',
        taxYear: 2025,
        formRevision: '2025',
        box1NonemployeeCompensation: '50000.00',
    },
    [fixtureHealthBusinessHash]: {
        dialect: businessExpensesDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-7206',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [],
    },
    [fixtureHealthAdjustmentsHash]: {
        dialect: adjustmentsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [
            {
                lineTag: 'selfEmployedHealthInsuranceMedicalDentalVision',
                datePaid: '2025-07-01',
                description: 'private family medical plan',
                amount: '9600.00',
                individual: 'taxpayer',
            },
            {
                lineTag: 'selfEmployedLongTermCareAgeFiftyOneToSixty',
                datePaid: '2025-07-01',
                description: 'long-term care contract',
                amount: '2400.00',
                individual: 'taxpayer',
            },
        ],
    },
    // Persona 5: the employee who exercised an incentive stock option and
    // held the shares. `alternativeMinimumTax` must be declared — the
    // tripwire fires on the DOCUMENT'S MERE PRESENCE, with no threshold,
    // because a Form 3921 is issued for nothing except an ISO exercise.
    [fixtureSweepIsoProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['alternativeMinimumTax'],
    },
    [fixtureSweepIsoHash]: {
        dialect: formThirtyNineTwentyOneDialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-SWEEP-ISO',
        taxYear: 2025,
        formRevision: 'April 2025',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        box1DateOptionGranted: '01/03/2023',
        box2DateOptionExercised: '03/13/2025',
        box3ExercisePricePerShare: '5.00',
        box4FairMarketValuePerShareOnExerciseDate: '105.00',
        box5NumberOfSharesTransferred: '2000',
    },
    // The Schedule E Part I wiring's own two documents. They exist for exactly
    // the reason the Form 4562 register below does: deleting the twin's
    // `vnd.fjs.rental_property` route branch has to redden something, and
    // `fjs/form1040/core`'s own Part I leaves cannot see it -- they hand
    // `form1040Report` a `Form1040Inputs` and never travel through this
    // program's collect step at all.
    [fixtureLandlordProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['rentalRealEstateAndRoyalties'],
    },
    [fixtureLandlordPropertyHash]: {
        dialect: rentalPropertyDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'RENT-0001',
        taxYear: 2025,
        propertyType: 'singleFamilyResidence',
        physicalAddress: '18 Alder Street, Wells, ME 04090',
        fairRentalDays: 365,
        personalUseDays: 0,
        rentsReceived: '9600.00',
        entries: [
            { category: 'taxes', datePaid: '2025-09-30', description: 'town property tax', amount: '1200.00' },
            { category: 'repairs', datePaid: '2025-05-02', description: 'boiler repair', amount: '350.00' },
        ],
    },
    // The Schedule F wiring's own two documents, for the identical reason:
    // deleting the twin's `vnd.fjs.farm` route branch has to redden something,
    // and `fjs/form1040/core`'s own Schedule F leaves cannot see it -- they
    // hand `form1040Report` a `Form1040Inputs` and never travel through this
    // program's collect step at all.
    [fixtureFarmerProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: ['farmIncomeOrLoss'],
    },
    [fixtureFarmerFarmHash]: {
        dialect: farmDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'FARM-0001',
        taxYear: 2025,
        principalCropOrActivity: 'corn and soybeans',
        accountingMethod: 'cash',
        materiallyParticipated: 'yes',
        investmentAtRisk: 'allAtRisk',
        salesOfRaisedProductsAndLivestock: '40000.00',
        cropInsuranceProceedsDeferredFromPriorYear: '0.00',
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [],
    },
    // **The Form 461 wiring's own document**: the same farm, $90,000.00 of feed
    // against $40,000.00 of raised products, printed box 36a checked. It exists
    // because nothing else in this fixture set can make Form 8995 printed line
    // 16 -- §199A(c)(2)'s carryforward to 2026 -- anything but zero, and a
    // rendering that hardcoded `'0.00'` for it would otherwise pass every leaf
    // here. (It does: that exact mutation survived the whole suite before this
    // fixture existed.)
    [fixtureFarmerLossFarmHash]: {
        dialect: farmDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'FARM-0001',
        taxYear: 2025,
        principalCropOrActivity: 'corn and soybeans',
        accountingMethod: 'cash',
        materiallyParticipated: 'yes',
        investmentAtRisk: 'allAtRisk',
        salesOfRaisedProductsAndLivestock: '40000.00',
        cropInsuranceProceedsDeferredFromPriorYear: '0.00',
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [{
            category: 'feed',
            datePaid: '2025-04-15',
            description: 'winter hay',
            amount: '90000.00',
        }],
    },
    // The Form 4562 wiring's own document. It exists for exactly the reason
    // the 1095-A fixture above does: deleting the twin's
    // `vnd.fjs.asset_register` route branch has to redden something, and
    // `fjs/form1040/core`'s own asset-register leaves cannot see it -- they
    // hand `form1040Report` a `Form1040Inputs` and never travel through this
    // program's collect step at all.
    //
    // `accountNumber` matches the business expenses record's `'BUS-0001'`,
    // because `fjs/schedule/c` refuses a register naming a different activity.
    [fixtureFounderRegisterHash]: {
        dialect: assetRegisterDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        businessOrActivity: 'software consulting',
        everyDepreciableAssetIsListed: true,
        noDepreciablePropertyDisposedOfDuringTheYear: true,
        priorYearSection179CarryoverIsZero: true,
        assets: [{
            description: 'laptop',
            datePlacedInService: '2025-06',
            costOrOtherBasis: '700.00',
            businessUsePercentage: '100.00',
            classification: 'sevenYear',
            method: '200DB',
            convention: 'HY',
            section168kStatus: 'electedOut',
        }],
    },
    // TAX-41's two. They exist for the reason the register above does, one
    // layer in: `vnd.fjs.asset_register` is already routed, so a deleted
    // branch reddens the leaf above -- but nothing anywhere proves that the
    // per-asset `disposal` BLOCK survives the round trip through the CAS
    // snapshot, the dialect's structural validation and `depreciableAssets`.
    // A nested optional object is exactly the shape that can be silently
    // dropped by a schema edit while every flat field still travels.
    [fixtureFounderDisposalProfileHash]: {
        dialect: returnProfileDialect,
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds: [
            'businessIncomeOrLoss', 'federalTaxWithheldOnOther1099', 'otherGainsOrLosses',
        ],
    },
    // NO `noDepreciablePropertyDisposedOfDuringTheYear`: the dialect refuses a
    // register carrying both it and a disposal block.
    [fixtureFounderDisposalRegisterHash]: {
        dialect: assetRegisterDialect,
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        businessOrActivity: 'software consulting',
        everyDepreciableAssetIsListed: true,
        priorYearSection179CarryoverIsZero: true,
        assets: [{
            description: 'laptop',
            datePlacedInService: '2023-06',
            costOrOtherBasis: '700.00',
            businessUsePercentage: '100.00',
            classification: 'sevenYear',
            method: '200DB',
            convention: 'HY',
            section168kStatus: 'electedOut',
            disposal: {
                dateAcquired: '2023-05-20',
                dateSold: '2025-04-15',
                grossSalesPrice: '300.00',
                expenseOfSale: '0.00',
            },
        }],
    },
}

/** @type {Readonly<Record<string, string>>} */
const snapshotBySubject = {
    [subjectProfile]: fixtureProfileHash,
    [subjectW2A]: fixtureW2AHash,
    [subjectW2B]: fixtureW2BHash,
    [subject1099G]: fixture1099GHash,
    [subjectOutOfScope]: fixtureOutOfScopeHash,
    [subjectW2PriorYear]: fixtureW2PriorYearHash,
    [subjectProfilePriorYear]: fixtureProfilePriorYearHash,
    [subjectCarryover]: fixtureCarryoverHash,
    [subjectW2NoYear]: fixtureW2NoYearHash,
    [subjectOutOfScopePriorYear]: fixtureOutOfScopePriorYearHash,
    [subjectCreditsProfile]: fixtureCreditsProfileHash,
    [subjectCreditsW2]: fixtureCreditsW2Hash,
    [subjectCreditsTuition]: fixtureCreditsTuitionHash,
    [subjectCreditsRecord]: fixtureCreditsRecordHash,
    [subjectCreditsProfileUndeclared]: fixtureCreditsProfileUndeclaredHash,
    [subjectRetireeProfile]: fixtureRetireeProfileHash,
    [subjectRetiree1099R]: fixtureRetiree1099RHash,
    [subjectRetireeIra]: fixtureRetireeIraHash,
    [subjectRetireeBasis]: fixtureRetireeBasisHash,
    [subjectRetireeProfileOnly]: fixtureRetireeProfileOnlyHash,
    [subjectFounderProfile]: fixtureFounderProfileHash,
    [subjectFounderNec]: fixtureFounderNecHash,
    [subjectFounderExpenses]: fixtureFounderExpensesHash,
    [subjectFounderRegister]: fixtureFounderRegisterHash,
    [subjectFounderDisposalProfile]: fixtureFounderDisposalProfileHash,
    [subjectFounderDisposalRegister]: fixtureFounderDisposalRegisterHash,
    [subjectFounderHomeExpenses]: fixtureFounderHomeExpensesHash,
    [subjectLandlordProfile]: fixtureLandlordProfileHash,
    [subjectLandlordProperty]: fixtureLandlordPropertyHash,
    [subjectFarmerProfile]: fixtureFarmerProfileHash,
    [subjectFarmerFarm]: fixtureFarmerFarmHash,
    [subjectFarmerLossFarm]: fixtureFarmerLossFarmHash,
    [subjectMarketplaceProfile]: fixtureMarketplaceProfileHash,
    [subjectMarketplaceW2]: fixtureMarketplaceW2Hash,
    [subjectMarketplaceStatement]: fixtureMarketplaceStatementHash,
    [subjectExpatriateProfile]: fixtureExpatriateProfileHash,
    [subjectExpatriateW2]: fixtureExpatriateW2Hash,
    [subjectSweepProfile]: fixtureSweepProfileHash,
    [subjectSweepInterest]: fixtureSweepInterestHash,
    [subjectSweepDividend]: fixtureSweepDividendHash,
    [subjectSweepSocialSecurity]: fixtureSweepSocialSecurityHash,
    [subjectSweepExemptDividend]: fixtureSweepExemptDividendHash,
    [subjectSweepSocialSecurityWithholding]: fixtureSweepSocialSecurityWithholdingHash,
    [subjectSweepPartnershipK1]: fixtureSweepPartnershipK1Hash,
    [subjectSweepSCorporationK1]: fixtureSweepSCorporationK1Hash,
    [subjectSweepEstateTrustK1]: fixtureSweepEstateTrustK1Hash,
    [subjectSweepGainsProfile]: fixtureSweepGainsProfileHash,
    [subjectSweepBrokerage]: fixtureSweepBrokerageHash,
    [subjectSweepSectionTwelveFiftySix]: fixtureSweepSectionTwelveFiftySixHash,
    [subjectSweepRealCarryover]: fixtureSweepRealCarryoverHash,
    [subjectSweepCorrectedBrokerage]: fixtureSweepCorrectedBrokerageHash,
    [subjectSweepBasisCorrection]: fixtureSweepBasisCorrectionHash,
    [subjectSweepEspp]: fixtureSweepEsppHash,
    [subjectSweepDeductionProfile]: fixtureSweepDeductionProfileHash,
    [subjectSweepItemized]: fixtureSweepItemizedHash,
    [subjectSweepMedical]: fixtureSweepMedicalHash,
    [subjectSweepAdjustmentProfile]: fixtureSweepAdjustmentProfileHash,
    [subjectSweepAdjustments]: fixtureSweepAdjustmentsHash,
    [subjectSweepStudentLoan]: fixtureSweepStudentLoanHash,
    [subjectSweepIsoProfile]: fixtureSweepIsoProfileHash,
    [subjectSweepIso]: fixtureSweepIsoHash,
    [subjectHealthProfile]: fixtureHealthProfileHash,
    [subjectHealthNec]: fixtureHealthNecHash,
    [subjectHealthBusiness]: fixtureHealthBusinessHash,
    [subjectHealthAdjustments]: fixtureHealthAdjustmentsHash,
}

/**
 * A host map matching the frozen `CasOp` vocabulary exactly, backed by the
 * fixture maps above rather than a real CAS/Evo store — the same technique
 * `fjs/report/payer/module.f.js`'s own unit proof uses, so this file proves
 * the program's AGGREGATION and its call into the engine without needing a
 * real store. The real store is `tax-return-integration.test.js`'s job.
 *
 * `subjects` is a parameter so a proof can present the SAME five documents
 * in a different enumeration order — which is what
 * {@link proof.subjectEnumerationOrderDoesNotChangeTheResult} needs and what
 * a fixed map could not express. The head hash is derived by prefixing the
 * subject, so `evoHead`/`evoRevision` remain two genuinely separate lookups
 * rather than one collapsed step.
 *
 * Every handler answers `ok`: this fixture's own lookups panic (via
 * `assertNotNullish`) rather than refusing, because a missing fixture entry
 * is a broken proof and not a case the report is meant to survive. The
 * `Result` return is `CasOp`'s — an operation set declares one channel for
 * all four — not a claim that any of these four can fail.
 * @type {(subjects: readonly string[]) => OperationMap<CasOp, Result<string, string>>}
 */
const hostMapOver = subjects => ({
    evoList: () => ok(JSON.stringify(subjects)),
    evoHead: (/** @type {string} */ subject) => ok(JSON.stringify([`head:${subject}`])),
    evoRevision: (/** @type {string} */ headHash) => ok(JSON.stringify({
        snapshot: assertNotNullish(
            snapshotBySubject[headHash.slice('head:'.length)],
            ['unknown head', headHash]),
    })),
    casRead: (/** @type {string} */ hash) =>
        ok(JSON.stringify(assertNotNullish(documentByHash[hash], ['unknown document hash', hash]))),
})

/** The fixture's five subjects, deliberately NOT in sorted order. */
const fixtureSubjects = [subjectW2B, subjectProfile, subjectOutOfScope, subject1099G, subjectW2A]

/** Phase 25's own four subjects, likewise NOT in sorted order. */
const creditsSubjects = [
    subjectCreditsTuition, subjectCreditsW2, subjectCreditsRecord, subjectCreditsProfile,
]

/** Phase 26's own four subjects, likewise NOT in sorted order. */
const retireeSubjects = [
    subjectRetireeBasis, subjectRetireeIra, subjectRetiree1099R, subjectRetireeProfile,
]

/** Phase 27's own three subjects, likewise NOT in sorted order. */
const founderSubjects = [
    subjectFounderExpenses, subjectFounderNec, subjectFounderProfile,
]

/** TAX-39: the same persona with the Form 8829 half of the business record. */
const founderWithHomeOfficeSubjects = [
    subjectFounderHomeExpenses, subjectFounderNec, subjectFounderProfile,
]

/** The same three, plus the Form 4562 wiring's asset register. */
const founderWithRegisterSubjects = [
    subjectFounderRegister, subjectFounderExpenses, subjectFounderNec, subjectFounderProfile,
]

/** TAX-41: the same business, but the register's laptop was SOLD. */
const founderWithDisposalSubjects = [
    subjectFounderDisposalRegister, subjectFounderExpenses, subjectFounderNec,
    subjectFounderDisposalProfile,
]

/** The Schedule E Part I wiring's own two subjects, NOT in sorted order. */
const landlordSubjects = [
    subjectLandlordProperty, subjectLandlordProfile,
]

/** The Schedule F wiring's own two subjects, likewise NOT in sorted order. */
const farmerSubjects = [
    subjectFarmerFarm, subjectFarmerProfile,
]

/** TAX-37's own three subjects, likewise NOT in sorted order. */
const marketplaceSubjects = [
    subjectMarketplaceStatement, subjectMarketplaceProfile, subjectMarketplaceW2,
]

/** TAX-42's own two, likewise NOT in sorted order. */
const expatriateSubjects = [subjectExpatriateW2, subjectExpatriateProfile]

/**
 * Runs the twin against a subject enumeration and returns its result.
 * @type {(subjects: readonly string[]) => TaxReturnResult}
 */
const runTwin = subjects => {
    const ctx = taxGuestCtx(assertNotNullish(taxParams2025, 'TY2025 parameters'))
    const [t, v] = interpret(hostMapOver(subjects))(taxReturnReport(ctx)([]))
    assert(t === 'ok', ['expected the tax return program to run to completion', t, v])
    if (t !== 'ok') {
        return { kind: 'error', message: 'unreachable', unmodeled: [] }
    }
    return v[0]
}

/**
 * Reads one printed line's cents out of a rendered result by its `rule`
 * string — a LOOKUP by a hand-typed rule, never an iteration over the
 * program's own output. A line that vanishes fails `assertNotNullish` here.
 * @type {(result: TaxReturnResult) => (rule: string) => bigint}
 */
const renderedCents = result => rule => {
    assert(result.kind === 'ok', ['expected a computed return', result])
    if (result.kind !== 'ok') {
        return 0n
    }
    const line = result.lines.find(candidate => candidate.rule === rule)
    return centsFromString(assertNotNullish(line, ['expected the report to carry', rule]).value)
}

/**
 * The dialect tags {@link collectDocument} dispatches on, and the
 * independently HAND-TYPED count of them.
 *
 * The count is the point: a loop over this list alone could never notice the
 * list shrinking (AGENTS.md's fourth shipped defect), so seventeen is written
 * out here and asserted beside the loop. It has been short THREE times —
 * Phase 24's two, found by Phase 25, and Phase 29's three, found by Phase 30.
 *
 * **Every prose count in this file's docstrings was stale before Phase 26**
 * — the module header said "eleven fields" and "twelve dialects" while the
 * twin dispatched on fifteen, because prose is not asserted and only
 * {@link expectedDispatchedDialectCount} below is. They are corrected in
 * this commit, and the correction is itself the argument: a number a reader
 * is asked to trust belongs beside an assertion, not inside a sentence.
 */
const dispatchedDialects = [
    returnProfileDialect,
    w2Dialect,
    oneZeroNineNineIntDialect,
    oneZeroNineNineDivDialect,
    oneZeroNineNineBDialect,
    oneZeroNineNineRDialect,
    ssa1099Dialect,
    itemizedDeductionsDialect,
    medicalExpensesDialect,
    priorYearCapitalLossDialect,
    oneZeroNineNineGDialect,
    // **These four were missing until Phase 25**, and the count below said
    // eleven while the twin dispatched on thirteen. Phase 24 added
    // `vnd.fjs.adjustments` and `vnd.fjs.1098e` to the source and the twin
    // and not to this list, so the one mechanical check on the hand-sync
    // silently stopped covering the two newest dialects — the same
    // hand-typed-list drift `fjs/return/scope`'s own modeled-kind list
    // suffered twice. Corrected here, with the two this phase adds.
    //
    // Phase 26 adds the SIXTEENTH and SEVENTEENTH, `vnd.fjs.ira` and
    // `vnd.fjs.prior_year_ira_basis`, moving the count from 15 to 17 in one
    // step — added to this list in the SAME commit that adds them to the
    // source and the twin, which is the discipline the paragraph above
    // exists to ask for.
    adjustmentsDialect,
    oneZeroNineEightEDialect,
    oneZeroNineEightTDialect,
    creditsDialect,
    iraDialect,
    priorYearIraBasisDialect,
    // Phase 27's own two (DOC-20/DOC-21), the EIGHTEENTH and NINETEENTH:
    // added here in the SAME commit that adds them to the source text and
    // to the twin, which is the discipline the paragraph above asks for.
    oneZeroNineNineNecDialect,
    businessExpensesDialect,
    // **Phase 29's three were missing from this list until Phase 30 added
    // them**, and that is the drift the paragraph above exists to warn about
    // happening a THIRD time. `vnd.fjs.form3921`, `vnd.fjs.form3922` and
    // `vnd.fjs.basis_correction` were added to the source text and to the twin
    // in Phase 29 and not here, so the one mechanical check on the hand-sync
    // silently stopped covering the three newest dialects — exactly as it did
    // for Phase 24's two before Phase 25 noticed.
    //
    // Restored here rather than reported and left, because this list is the
    // mechanism Phase 30's own two entries depend on: a check that is already
    // three short is not a check the next entry can lean on.
    formThirtyNineTwentyOneDialect,
    formThirtyNineTwentyTwoDialect,
    basisCorrectionDialect,
    // Phase 30's own two (DOC-24), the TWENTY-THIRD and TWENTY-FOURTH: added
    // here in the SAME commit that adds them to the source text and to the
    // twin.
    k1PartnershipDialect,
    k1SCorporationDialect,
    // TAX-35's own, the TWENTY-FIFTH: `vnd.fjs.k1_1041`, added here in the SAME
    // commit that adds it to the source text and to the twin. It was registered
    // in both dialect registries by an earlier commit on this branch and read
    // by NOTHING -- the `box13StatutoryEmployee` shape -- and this entry is
    // half of what closes that; `fjs/schedule/e`'s `beneficiaryRow` is the
    // other half.
    k1EstateTrustDialect,
    // TAX-37's own, the TWENTY-SIXTH: `vnd.fjs.1095a`, added here in the SAME
    // commit that adds it to the source text and to the twin. Without this
    // entry a stored Form 1095-A would be classified, served a schema, and
    // then dropped on the floor by the one program that actually assembles a
    // return -- which is the shape of the "form with no production caller"
    // this repo has shipped before.
    oneZeroNineFiveADialect,
    // The Form 4562 wiring's own, the TWENTY-SEVENTH:
    // `vnd.fjs.asset_register`, added here in the SAME commit that adds it to
    // the source text and to the twin. Without this entry a stored register
    // would be classified, served a schema, and then dropped on the floor by
    // the one program that actually assembles a return -- and Schedule C line
    // 13 would silently go back to zero for every filer who stored one.
    assetRegisterDialect,
    // The Schedule E Part I wiring's own, the TWENTY-EIGHTH:
    // `vnd.fjs.rental_property`, added here in the SAME commit that adds it to
    // the source text and to the twin. Without this entry a stored rental
    // property would be classified, served a schema, and then dropped on the
    // floor by the one program that actually assembles a return -- and printed
    // Schedule E line 26 would stay the documented zero it was before the part
    // existed, for every landlord who stored one.
    rentalPropertyDialect,
    // The Schedule F wiring's own, the TWENTY-NINTH: `vnd.fjs.farm`, added
    // here in the SAME commit that adds it to the source text and to the twin.
    // Without this entry a stored farm would be classified, served a schema,
    // and then dropped on the floor by the one program that actually assembles
    // a return -- and printed Schedule 1 line 6 would stay the documented zero
    // it was before Schedule F existed, for every farmer who stored one.
    farmDialect,
]

/**
 * `28 -> 29` is the Schedule F wiring's own `vnd.fjs.farm`. `27 -> 28` is the Schedule E Part I wiring's own `vnd.fjs.rental_property`. `26 -> 27` is the Form 4562 wiring's own `vnd.fjs.asset_register`. `25 -> 26` is TAX-37's own `vnd.fjs.1095a`. `24 -> 25` is TAX-35's own `vnd.fjs.k1_1041`. `19 -> 24` in Phase 30: three of the five are Phase 29's, restored, and two
 * are this phase's own. See the list's own comments for both halves.
 * @type {number}
 */
const expectedDispatchedDialectCount = 29

export const proof = {
    // The phase's central number check, and the reason this module exists:
    // a program written against nothing but `ctx` computes a REAL 1040 from
    // stored documents.
    //
    // Every expected value below is hand-typed at the assertion and derived
    // independently of this repository's code — the same six figures
    // 20-VERIFICATION.md recorded when it ran this shape of return through
    // `form1040Report` directly. Arithmetic a reader can check without
    // running anything: wages $35,937.00 + $9,568.00 = $45,505.00 (line 1a);
    // plus $4,554.00 of unemployment compensation (line 8) = $50,059.00 of
    // total income (line 9); less TY2025's $15,750.00 single standard
    // deduction = $34,309.00 of taxable income (line 15); tax from the Tax
    // Table = $3,881.00 (line 16); withholding $6,384.00 + $2,578.00 =
    // $8,962.00 (line 25a) plus $454.00 (line 25b) = $9,416.00 of payments;
    // $9,416.00 - $3,881.00 = $5,535.00 overpaid (line 34).
    aStoredProgramComputesTheWholeReturnFromStoredDocuments: () => {
        const result = runTwin(fixtureSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        assertEq(result.taxYear, 2025)
        assertEq(result.line16Method, 'taxTable')
        // Hand-typed: Form 1040 carries 56 printed money lines between 1a
        // and 37 (`fjs/form1040/core`'s own count, written out again here
        // rather than imported — a count read out of the code under test
        // moves with it and can never fail).
        assertEq(result.lines.length, 56)
        const cents = renderedCents(result)
        assertEq(cents('1040 line 1a'), 4550500n)
        assertEq(cents('1040 line 8'), 455400n)
        assertEq(cents('1040 line 9'), 5005900n)
        assertEq(cents('1040 line 15'), 3430900n)
        assertEq(cents('1040 line 16 (Tax Table)'), 388100n)
        assertEq(cents('1040 line 25a'), 896200n)
        assertEq(cents('1040 line 25b'), 45400n)
        assertEq(cents('1040 line 34'), 553500n)
    },
    // Traceability survives the crossing (PROV-01/PROV-02): every rendered
    // line still names at least one source, and line 8 still cites the
    // 1099-G's own box by document hash and box path — the citation an
    // auditor follows. A rendering that dropped `sources` would leave every
    // number in the return unattributable, and the count assertion above
    // would not notice.
    everyRenderedLineKeepsItsCitations: () => {
        const result = runTwin(fixtureSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        for (const line of result.lines) {
            assert(line.sources.length > 0, ['a rendered line carries no source', line.rule])
        }
        const lineEight = assertNotNullish(
            result.lines.find(candidate => candidate.rule === '1040 line 8'),
            'expected line 8')
        assert(
            lineEight.sources.some(s =>
                s.documentHash === fixture1099GHash && s.boxPath === 'box1UnemploymentCompensation'),
            ['expected line 8 to cite the 1099-G box it was computed from', lineEight.sources])
    },
    // PROV-05's enabling property, at this layer: the SAME five documents
    // presented in a DIFFERENT enumeration order produce byte-identical
    // output. `evoList`'s order follows `cas.list()`, so writing any new
    // blob can reorder it — without the program's own sort, a pinned rerun
    // could still move.
    subjectEnumerationOrderDoesNotChangeTheResult: () => {
        const forward = jsonText(runTwin(fixtureSubjects))
        const reversed = jsonText(runTwin([...fixtureSubjects].reverse()))
        assertEq(forward, reversed)
        // The control: the two orderings really are different, so the
        // equality above is evidence rather than a comparison of one list
        // with itself.
        assert(
            jsonText(fixtureSubjects) !== jsonText([...fixtureSubjects].reverse()),
            'the two enumerations must genuinely differ')
    },
    // The document-set refusals, as VALUES rather than throws — and each
    // paired with the control that the legitimate case is not refused
    // (AGENTS.md: a gate needs a control; the control here is the computed
    // return in the leaves above, plus the explicit non-refusal below).
    documentSetRefusals: {
        noProfileIsRefusedByName: () => {
            const result = runTwin([subjectW2A, subject1099G])
            assertEq(result.kind, 'error')
            if (result.kind === 'error') {
                assert(
                    result.message.includes('vnd.fjs.return_profile'),
                    ['the refusal must name the missing dialect', result.message])
                assertEq(result.unmodeled.length, 0)
            }
        },
        // A second profile is refused rather than silently resolved by
        // enumeration order — the failure this program must not have.
        twoProfilesAreRefusedRatherThanSilentlyPicked: () => {
            const result = runTwin([subjectProfile, subjectProfile, subjectW2A])
            assertEq(result.kind, 'error')
            if (result.kind === 'error') {
                assert(
                    result.message.includes('exactly one filer'),
                    ['the refusal must say why two profiles cannot be resolved', result.message])
            }
        },
        // The control for both refusals: exactly one profile plus documents
        // computes, and adds nothing from the out-of-scope dialect.
        oneProfileComputesAndAnUnknownDialectIsIgnored: () => {
            const withOutOfScope = runTwin(fixtureSubjects)
            const withoutOutOfScope = runTwin(
                fixtureSubjects.filter(subject => subject !== subjectOutOfScope))
            assertEq(withOutOfScope.kind, 'ok')
            assertEq(jsonText(withOutOfScope), jsonText(withoutOutOfScope))
        },
    },
    // ── The mixed-year refusal (Phase 21) ────────────────────────────
    //
    // Before this phase no program could reach the engine, so mixing years
    // was unreachable. This program is what makes it reachable, so this
    // program is what must refuse. Each leaf below moves exactly one clause
    // of the rule; the module header states the rule and why refusing is not
    // the same decision as filtering.
    taxYearRefusal: {
        // The gate and its control, in ONE leaf, deliberately: a refusal
        // that always fires is not a refusal, and separating the two invites
        // reading the gate alone. The SAME store, minus the one 2024 W-2,
        // computes the fixture's own hand-typed refund.
        aPriorYearW2IsRefusedAndTheSameStoreWithoutItComputes: () => {
            const refused = runTwin([...fixtureSubjects, subjectW2PriorYear])
            assertEq(refused.kind, 'error')
            // Not merely "an error": the mixed-year error. Asserting the
            // kind alone would pass for the no-profile refusal too.
            if (refused.kind === 'error') {
                assert(
                    refused.message.includes('mixing tax years'),
                    ['expected the mixed-year refusal', refused.message])
            }
            const control = runTwin(fixtureSubjects)
            assert(control.kind === 'ok', ['the same store without the 2024 W-2 must compute', control])
            if (control.kind === 'ok') {
                assertEq(renderedCents(control)('1040 line 34'), 553500n)
            }
        },
        // All FOUR facts a reader can act on. Phase 20 shipped a refusal
        // whose destination string could be erased with the suite fully
        // green, because five leaves asserted the easy half of the message
        // and none asserted the informative half. Each of these four is
        // hand-typed here and each is separately erasable at the site, so
        // erasing any one of them reddens this leaf.
        theRefusalNamesAllFourFacts: () => {
            const refused = runTwin([...fixtureSubjects, subjectW2PriorYear])
            assert(refused.kind === 'error', ['expected a refusal', refused])
            if (refused.kind !== 'error') {
                return
            }
            // WHICH document — the CAS hash a reader can go and `cas_get`.
            assert(
                refused.message.includes(fixtureW2PriorYearHash),
                ['the refusal must name the offending document hash', refused.message])
            // WHAT it is.
            assert(
                refused.message.includes('vnd.fjs.w2'),
                ['the refusal must name the offending dialect', refused.message])
            // The year it is stored FOR, and the year the run computes.
            // Hand-typed, and deliberately different numbers, so a message
            // that printed one of them twice fails here.
            assert(
                refused.message.includes('2024'),
                ['the refusal must name the document\'s own tax year', refused.message])
            assert(
                refused.message.includes('2025'),
                ['the refusal must name the year this run computes', refused.message])
        },
        // The run's year is the CALLER's (PROV-04), reaching the program as
        // `ctx.taxParams.taxYear`. A profile claiming a different year does
        // not redefine the run — it is itself the mismatch, and is named as
        // one. The control is the ordinary fixture, whose profile agrees.
        theRunsYearWinsOverTheProfilesOwn: () => {
            const refused = runTwin([subjectProfilePriorYear, subjectW2A])
            assertEq(refused.kind, 'error')
            if (refused.kind === 'error') {
                assert(
                    refused.message.includes('mixing tax years'),
                    ['expected the mixed-year refusal', refused.message])
                assert(
                    refused.message.includes(returnProfileDialect),
                    ['the refusal must name the profile as the offender', refused.message])
            }
        },
        // The ONE exemption, proven real rather than assumed: a capital loss
        // carryover carries a PRIOR year by definition, so a 2024 carryover
        // must not refuse a 2025 run — and the return it produces is still
        // the fixture's own, unchanged.
        aPriorYearCarryoverIsExemptAndStillComputes: () => {
            const result = runTwin([...fixtureSubjects, subjectCarryover])
            assert(result.kind === 'ok', ['a prior-year carryover must not refuse the run', result])
            if (result.kind === 'ok') {
                assertEq(renderedCents(result)('1040 line 34'), 553500n)
            }
        },
        // The SECOND exemption, added in Phase 26 (TAX-29) and proven real
        // rather than assumed exactly as the first is: Form 8606's line 2 is
        // "the amount from line 14 of THAT Form 8606", meaning last year's,
        // so a 2024 basis document must not refuse a 2025 run — and the
        // return it produces is still the fixture's own, unchanged.
        // It is deliberately NOT bolted onto the Phase 21 fixture the way the
        // capital-loss control above is. A stored basis with no
        // `vnd.fjs.ira` record beside it is itself a REFUSAL
        // (`fjs/form8606`'s own "ignoring the basis would tax after-tax money
        // a second time"), so that arrangement would refuse for a reason that
        // has nothing to do with the year rule and would prove nothing about
        // it. The retiree fixture, which carries both, is the honest control.
        aPriorYearIraBasisIsExemptAndStillComputes: () => {
            const result = runTwin(retireeSubjects)
            assert(result.kind === 'ok', ['a prior-year IRA basis must not refuse the run', result])
            if (result.kind === 'ok') {
                assertEq(renderedCents(result)('1040 line 4b'), 2667000n, '$26,670.00')
            }
            // And the direct evidence: dropping the exemption would produce
            // the MIXED-YEAR message specifically, so its absence is what is
            // asserted — not merely that some error did not occur.
            const withoutTheBasis = runTwin(
                retireeSubjects.filter(subject => subject !== subjectRetireeBasis))
            assertEq(withoutTheBasis.kind, 'ok')
            if (withoutTheBasis.kind === 'ok') {
                // Without the basis document, Form 8606 Part I does not apply
                // at all and line 4b is simply the box-2a sum less the QCD:
                // $50,000.00 - $20,000.00 = $30,000.00. So the 2024 document
                // is genuinely being READ rather than merely tolerated.
                assertEq(renderedCents(withoutTheBasis)('1040 line 4b'), 3000000n, '$30,000.00')
            }
        },
        // The deliberate narrowing (module header): a dialect the engine has
        // no field for is never handed to it, so its year cannot make a line
        // wrong and must not block the return. Without this leaf the
        // narrowing would be an accident of where the check sits.
        anUnroutedDialectWithAMismatchedYearStillComputes: () => {
            const result = runTwin([...fixtureSubjects, subjectOutOfScopePriorYear])
            assert(result.kind === 'ok', ['an unrouted 2024 document must not block the return', result])
            if (result.kind === 'ok') {
                assertEq(renderedCents(result)('1040 line 34'), 553500n)
            }
        },
        // The rule's presence clause: "if a document CARRIES a taxYear".
        // Unreachable for a validated document — every routed dialect
        // declares `taxYear` as required — but the rule is data-driven
        // rather than a dialect list precisely so it keeps working when that
        // stops being true, and an unexercised branch is not a rule.
        aRoutedDocumentWithNoYearAtAllIsNotRefused: () => {
            const result = runTwin([...fixtureSubjects, subjectW2NoYear])
            assert(result.kind === 'ok', ['a document carrying no year must not be refused', result])
            if (result.kind === 'ok') {
                assertEq(renderedCents(result)('1040 line 34'), 553500n)
            }
        },
    },
    // ── Phase 25 (TAX-25/TAX-26): the two new dialects, through the STORED
    //    PROGRAM rather than only through the host twin ─────────────────────
    //
    // Every figure below is the one `fjs/form1040/core`'s own
    // `scheduleThreeCredits` block hand-derives, restated here rather than
    // imported: wages $39,000.00 (line 1a and line 11); less TY2025's
    // $15,750.00 single standard deduction = $23,250.00 of taxable income;
    // Tax Table = $2,555.00; Schedule 3 line 3 (education, nonrefundable)
    // $1,500.00 plus line 4 (saver's) $200.00 = $1,700.00 on line 20; line
    // 22 = $855.00; the refundable 40% of the $2,500.00 American Opportunity
    // Credit = $1,000.00 on line 29; $1,000.00 - $855.00 = $145.00 overpaid.
    //
    // What this leaf proves that the direct one cannot: the `route` branches
    // for `vnd.fjs.1098t` and `vnd.fjs.credits` are real. Delete either and
    // the credits vanish, because no other fixture in this repository carries
    // a document of either dialect through this program.
    //
    // `[CORRECTED, Phase 26]` This paragraph said "the SOURCE TEXT's own
    // `route` branches", which is not what it proves: `runTwin` interprets
    // {@link taxReturnReport}, the function twin, and the literal source text
    // is executed only by `tax-return-integration.test.js`. The sentence is
    // narrowed to what is true; the source text's own branches are covered by
    // {@link proof.sourceAndTwinDispatchOnTheSameNineteenDialects}'s
    // verbatim-tag grep alone, and Phase 26's own retiree leaf below states
    // the same gap for the two dialects it adds.
    storedProgramRoutesTheTwoCreditDialectsAndComputesBothCredits: () => {
        const result = runTwin(creditsSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 1a'), 3900000n)
        assertEq(cents('1040 line 15'), 2325000n)
        assertEq(cents('1040 line 16 (Tax Table)'), 255500n)
        assertEq(cents('1040 line 20'), 170000n, '$1,700.00 through Schedule 3 Part I')
        assertEq(cents('1040 line 22'), 85500n)
        assertEq(cents('1040 line 29'), 100000n, '$1,000.00 refundable, NOT through Schedule 3')
        assertEq(cents('1040 line 34'), 14500n, '$145.00 overpaid')
    },
    // **Criterion 4 through the stored program.** The SAME wages and the
    // SAME W-2 — including its box 12 code D deferral — with the two credit
    // documents withheld AND the three kinds undeclared. Line 20 and line 29
    // go to zero and the taxpayer OWES the whole $2,555.00, which is exactly
    // what this engine computed for this return before Phase 25.
    theSameStoredReturnClaimingNoCreditsOwesTheWholeTax: () => {
        const result = runTwin([subjectCreditsW2, subjectCreditsProfileUndeclared])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 16 (Tax Table)'), 255500n, 'the same tax')
        assertEq(cents('1040 line 20'), 0n)
        assertEq(cents('1040 line 29'), 0n)
        assertEq(cents('1040 line 37'), 255500n, 'and the whole of it owed')
    },
    // …and the OTHER control, which is the more interesting of the two: the
    // same W-2 with the credit DECLARED and the credits document withheld is
    // REFUSED rather than quietly given $0. Declaring the kind is what turns
    // this engine's silence into a question, and this leaf is what says the
    // two cases really are different. `fjs/form8880`'s own docstring records
    // the gap the first case leaves open.
    theSameStoredReturnDeclaringTheCreditWithoutItsDocumentIsRefused: () => {
        const result = runTwin([subjectCreditsW2, subjectCreditsProfile])
        assertEq(result.kind, 'error', 'a declared credit with no answers must refuse')
        if (result.kind === 'error') {
            assert(
                result.message.includes('§25B(c)'),
                ['the refusal must name the provision', result.message],
            )
            assertEq(
                result.unmodeled.length,
                0,
                'a document-data-sufficiency refusal names no fjs/return/scope kind',
            )
        }
    },
    // ── Phase 26 (TAX-28/TAX-29): the two new dialects, through the STORED
    //    PROGRAM rather than only through the host twin ─────────────────────
    //
    // Every figure below is hand-derived here, independently of any other
    // file. A 65-or-older single retiree, one IRA:
    //
    //   1099-R box 1 = box 2a                          $50,000.00
    //   QCD to a food bank                             $20,000.00
    //   prior-year Form 8606 line 14 (2024)            $20,000.00
    //   value of ALL traditional IRAs at 31 Dec       $150,000.00
    //
    //   line 4a                                        $50,000.00  (GROSS)
    //   Form 8606 line 7 = 50,000 - 20,000             $30,000.00
    //   line 9 = 150,000 + 30,000                     $180,000.00
    //   line 10 = 20,000 / 180,000 = 0.1111 -> 0.111        0.111
    //   line 12 = 30,000 x 0.111                        $3,330.00
    //   line 15c = 30,000 - 3,330 -> 1040 line 4b      $26,670.00
    //
    //   line 9 / line 11 (AGI)                         $26,670.00
    //   line 12e = 15,750 + 2,000 (one age box)        $17,750.00
    //   line 13b senior deduction (AGI under 75,000)    $6,000.00
    //   line 14                                        $23,750.00
    //   line 15 = 26,670 - 23,750                       $2,920.00
    //   line 16: $2,920 falls in a $25-WIDE Tax Table row (the band
    //     structure is $25 below $3,000 and $50 above it), so the row is
    //     $2,900.00-$2,925.00, its midpoint is $2,912.50, and 10% of that
    //     is $291.25, rounded to the nearest dollar                $291.00
    //   line 37 amount owed                               $291.00
    //
    // **What this leaf proves, stated precisely, because the neighbouring
    // Phase 25 leaf overstates the same claim and it was worth checking.**
    // `runTwin` interprets {@link taxReturnReport} — the TWIN — so what is
    // proven here is that the twin's `route` and `noteYearMismatch` branches
    // for `vnd.fjs.ira` and `vnd.fjs.prior_year_ira_basis` are real: delete
    // either and the QCD or the basis vanishes, because no other fixture in
    // this repository carries a document of either dialect through this
    // program.
    //
    // The SOURCE TEXT's own branches are a separate question, and this file
    // covers them only through
    // {@link proof.sourceAndTwinDispatchOnTheSameNineteenDialects}'s
    // verbatim-tag grep. The one place the literal source is EXECUTED is
    // `tax-return-integration.test.js`, whose fixture is Phase 21's two W-2s
    // and one 1099-G and carries no Form 1099-R at all — so the source's
    // handling of these two dialects is checked by a `String.includes`, not
    // by a computed figure. **That is a real gap and it is named here rather
    // than papered over**; closing it means adding an IRA to that harness's
    // seeded document set, which also moves its hand-typed `readCount` and is
    // a change to a server integration test rather than to a proof.
    storedProgramRoutesTheTwoIraDialectsAndComputesTheQcdAndTheBasis: () => {
        const result = runTwin(retireeSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 4a'), 5000000n, '$50,000.00 — line 4a stays GROSS')
        assertEq(cents('1040 line 4b'), 2667000n, '$26,670.00')
        assertEq(cents('1040 line 11a'), 2667000n, '$26,670.00 AGI')
        assertEq(cents('1040 line 13b'), 600000n, '$6,000.00 senior deduction')
        assertEq(cents('1040 line 15'), 292000n, '$2,920.00')
        assertEq(cents('1040 line 16 (Tax Table)'), 29100n, '$291.00')
        assertEq(cents('1040 line 37'), 29100n, '$291.00 owed')
        // PROV-01/PROV-02 survive the crossing: line 4b still names the gift
        // it was reduced by, and the prior-year basis it was computed with.
        const line4b = assertNotNullish(
            result.lines.find(candidate => candidate.rule === '1040 line 4b'), 'expected line 4b')
        assert(
            line4b.sources.some(source =>
                source.documentHash === fixtureRetireeIraHash
                && source.boxPath === 'qualifiedCharitableDistributions[charity=Riverside Food Bank]'),
            ['line 4b must cite the gift', line4b.sources])
        assert(
            line4b.sources.some(source =>
                source.documentHash === fixtureRetireeBasisHash
                && source.boxPath === 'priorYearForm8606Line14'),
            ['line 4b must cite the prior-year basis', line4b.sources])
    },
    // **Criterion 4 through the stored program, and the price of the silence.**
    // The SAME 1099-R and the SAME profile with both new documents withheld:
    // line 4b is the full $50,000.00, AGI is $50,000.00, line 15 is
    // $50,000.00 - $23,750.00 = $26,250.00, which is above $3,000 and so
    // falls in a $50-wide row ($26,250.00-$26,300.00, midpoint $26,275.00);
    // 11,925 x 10% + (26,275 - 11,925) x 12% = 1,192.50 + 1,722.00 =
    // $2,914.50, rounded to $2,915.00.
    //
    // So this engine charged this retiree **$2,915.00 where the law charges
    // $291.00** — $2,624.00 too much, silently, with full citations and no
    // warning. That is the number TAX-28 and TAX-29 exist for, and it is
    // written here rather than described.
    theSameRetireeWithoutTheTwoDocumentsIsTheOverstatementThisPhaseCloses: () => {
        const result = runTwin([subjectRetiree1099R, subjectRetireeProfileOnly])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 4a'), 5000000n, 'the same gross figure')
        assertEq(cents('1040 line 4b'), 5000000n, 'taxed in full')
        assertEq(cents('1040 line 15'), 2625000n, '$26,250.00')
        assertEq(cents('1040 line 16 (Tax Table)'), 291500n, '$2,915.00')
        assertEq(cents('1040 line 37'), 291500n, '$2,915.00 owed')
    },
    // ── Phase 27 (DOC-20/DOC-21/TAX-30): the two new dialects, through the
    //    STORED PROGRAM rather than only through the host twin ─────────────
    //
    // Every figure hand-derived here, independently of any other file. A
    // single filer with one client and one business expense:
    //
    //   Form 1099-NEC box 1                                     $350.00
    //   Schedule C line 8    advertising                         $90.00
    //   Schedule C line 31   350.00 - 90.00                     $260.00
    //   Schedule 1 line 3, then line 10                         $260.00
    //   1040 line 8                                             $260.00
    //   1040 line 9          nothing else at all                $260.00
    //   1040 line 11a        adjusted gross income              $260.00
    //   1040 line 12e        single standard deduction       $15,750.00
    //   1040 line 15         max(0, 260.00 - 15,750.00)           $0.00
    //   Form 1099-NEC box 4                                      $40.00
    //   1040 line 25b        1099-family withholding             $40.00
    //   1040 line 34         overpaid, refunded in full          $40.00
    //
    // What this leaf proves that `fjs/form1040/core`'s own end-to-end leaf
    // cannot: the TWIN's `route` branches for `vnd.fjs.1099nec` and
    // `vnd.fjs.business_expenses` are real. Delete either and the business
    // income vanishes, because no other fixture in this repository carries a
    // document of either dialect through this program.
    //
    // The same narrowing Phase 26's own leaf records applies here: `runTwin`
    // interprets the function twin, and the literal SOURCE text is executed
    // only by `tax-return-integration.test.js`, whose fixture carries neither
    // dialect. The source's own two branches are covered by
    // {@link proof.sourceAndTwinDispatchOnTheSameNineteenDialects}'s
    // verbatim-tag grep alone. That is a real gap, named rather than papered
    // over, and it is the identical one Phases 25 and 26 each left.
    // TAX-37. What this leaf proves that `fjs/form1040/core`'s own
    // `premiumTaxCreditReachesTheReturn` block cannot: the TWIN's `route`
    // branch for `vnd.fjs.1095a` is real. Delete it and this leaf is the ONLY
    // thing in the repository that goes red — verified by mutation, which is
    // why this fixture exists.
    //
    // The arithmetic is Form 8962's, worked in `fjs/form8962`'s own annual
    // path: household income $30,000.00 is 199% of the $15,060.00 poverty
    // line, the applicable figure is 0.0196, line 8a is $588.00, the credit
    // allowed is min($9,600.00, $10,200.00 - $588.00) = $9,600.00, the
    // advance paid is $4,800.00, and the net premium tax credit is
    // $4,800.00.
    // TAX-42, through the STORED PROGRAM: a single filer with $90,000.00 of
    // wages on a U.S. Form W-2 for work performed abroad the whole year, and
    // a $60,000.00 §911 exclusion.
    //
    // Every figure hand-derived from the printed brackets, independently of
    // this repository's code:
    //   line 1a  $90,000.00 of wages
    //   line 8   −$60,000.00 (Schedule 1 line 8d, Form 2555 line 45)
    //   line 9   $30,000.00 of total income
    //   line 15  $30,000.00 − $15,750.00 = $14,250.00 of taxable income
    //   line 16  the Foreign Earned Income Tax Worksheet:
    //            tax on $74,250 (Tax Table, midpoint $74,275) = $11,255.00
    //            less tax on $60,000 (midpoint $60,025)       =  $8,120.00
    //                                                         =  $3,135.00
    //   line 25a $9,000.00 withheld; line 34 $9,000.00 − $3,135.00 = $5,865.00
    //
    // **The method tag is asserted, not only the cents**: a wrapper that
    // silently fell through to the Tax Table would charge $1,475.00 here, and
    // a value-only assertion on a different fixture might not have noticed.
    storedProgramComputesAForeignEarnedIncomeExclusionEndToEnd: () => {
        const result = runTwin(expatriateSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        assertEq(result.line16Method, 'foreignEarnedIncomeTaxWorksheet')
        const cents = renderedCents(result)
        assertEq(cents('1040 line 1a'), 9000000n, '$90,000.00 of wages')
        assertEq(cents('1040 line 8'), -6000000n, 'NEGATIVE $60,000.00 on Schedule 1 line 8d')
        assertEq(cents('1040 line 9'), 3000000n, '$30,000.00 of total income')
        assertEq(cents('1040 line 15'), 1425000n, '$14,250.00 of taxable income')
        assertEq(
            cents('1040 line 16 (Foreign Earned Income Tax Worksheet)'), 313500n,
            '$11,255.00 − $8,120.00 = $3,135.00 — and the RULE names the worksheet, so a '
            + 'silent fall-through to the Tax Table could not satisfy this lookup')
        assertEq(cents('1040 line 25a'), 900000n, '$9,000.00 withheld')
        assertEq(cents('1040 line 34'), 586500n, '$5,865.00 overpaid')
    },
    storedProgramRoutesFormTenNinetyFiveAAndComputesThePremiumTaxCredit: () => {
        const result = runTwin(marketplaceSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 1a'), 3000000n, '$30,000.00 of wages')
        assertEq(cents('1040 line 31'), 480000n, '$4,800.00 of net premium tax credit')
        assertEq(cents('1040 line 25a'), 200000n, '$2,000.00 withheld')
        assertEq(cents('1040 line 33'), 680000n, '$6,800.00 of total payments')
    },
    // THE CONTROL: the same filer with the Form 1095-A withheld. The credit
    // disappears and the return still computes, so the leaf above is evidence
    // about the DOCUMENT rather than about the profile.
    theSameStoredFilerWithoutTheFormTenNinetyFiveAComputesNoCredit: () => {
        const result = runTwin([subjectMarketplaceProfile, subjectMarketplaceW2])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 1a'), 3000000n, 'the same $30,000.00 of wages')
        assertEq(cents('1040 line 31'), 0n, 'and no premium tax credit at all')
    },
    /**
     * ★ **TAX-39: Form 8829 reaches the RENDERED report through the stored
     * program.** The leaf below, which carries the same persona without the
     * home office, is its control: $260.00 against $37.44, a difference of
     * exactly Form 8829 line 36.
     *
     * What it proves that `fjs/form1040/core`'s own leaf cannot: the Form 8829
     * record survives serialization into a stored BLOB, structural validation
     * against `vnd.fjs.business_expenses`, and `routeDocument`'s existing
     * branch — **with no new branch and no new dialect**, which is the design
     * decision this fixture exists to price. A `vnd.fjs.home_office` would
     * have needed its own route, its own tag in the source twin and its own
     * row in the dispatch count.
     */
    storedProgramRoutesAFormEightyEightTwentyNineInsideTheBusinessRecord: () => {
        const result = runTwin(founderWithHomeOfficeSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        // $350.00 of receipts, $90.00 of advertising, $222.56 of Form 8829
        // line 36. Every figure hand-derived at the fixture above.
        assertEq(cents('1040 line 8'), 3744n, '$37.44 — $260.00 less Form 8829’s $222.56')
        assertEq(cents('1040 line 9'), 3744n, 'and it is the whole of total income')
        assertEq(cents('1040 line 11a'), 3744n, 'AGI = $37.44')
        assertEq(cents('1040 line 15'), 0n, 'taxable income still floors at zero')
        assertEq(cents('1040 line 25b'), 4000n, 'the $40.00 of backup withholding is untouched')
    },
    storedProgramRoutesTheTwoBusinessDialectsAndComputesScheduleC: () => {
        const result = runTwin(founderSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 26000n, '$260.00 through Schedule 1 Part I')
        assertEq(cents('1040 line 9'), 26000n, 'and it is the whole of total income')
        assertEq(cents('1040 line 11a'), 26000n, 'AGI = $260.00')
        assertEq(cents('1040 line 15'), 0n, 'taxable income floors at zero')
        assertEq(cents('1040 line 25b'), 4000n, '$40.00 of §3406 backup withholding')
        assertEq(cents('1040 line 34'), 4000n, '$40.00 overpaid')
    },
    /**
     * ★ **THE ROUTING LEAF FOR `vnd.fjs.asset_register`.** The stored program
     * classifies the register, files it in `assetRegisters`, and its Form 4562
     * line 22 reaches Schedule C line 13 and therefore 1040 line 8.
     *
     * Every figure hand-computed: gross receipts $350.00 (Form 1099-NEC box 1)
     * less $90.00 of advertising less Publication 946 Table A-1's 7-year
     * half-year year-1 rate of 14.29% on $700.00 — **$100.03** — is
     * **$159.97**.
     *
     * The leaf above, which withholds the register, is what makes this one
     * evidence about the ROUTE: without it, `$159.97` and `$260.00` would be
     * two numbers with no relationship anybody had asserted.
     */
    storedProgramRoutesTheAssetRegisterAndDepreciatesScheduleCLineThirteen: () => {
        const result = runTwin(founderWithRegisterSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 15997n, '$260.00 less $100.03 of depreciation')
        assertEq(cents('1040 line 9'), 15997n, 'and it is the whole of total income')
        assertEq(cents('1040 line 11a'), 15997n, 'AGI = $159.97')
        assertEq(cents('1040 line 25b'), 4000n, 'the §3406 backup withholding is untouched')
    },
    /**
     * ★ **THE ROUTING LEAF FOR THE `disposal` BLOCK.** `vnd.fjs.asset_register`
     * is already dispatched — the leaf above proves that — so what this one
     * proves is different and nothing else can: that the per-asset NESTED
     * `disposal` object survives the CAS snapshot, the dialect's structural
     * validation and `depreciableAssets`, and reaches printed Form 4797.
     *
     * A nested optional block is exactly the shape a schema edit can drop in
     * silence while every flat field beside it still travels, and this program
     * is the only path in the repository that reads a stored blob rather than
     * a hand-built `Form1040Inputs`.
     *
     * Every figure hand-computed off the printed pages. The laptop cost
     * $700.00, was placed in service in June 2023 and sold on 15 April 2025 for
     * $300.00 — held more than a year, so Part I, and at a LOSS, so no
     * certification is needed anywhere:
     *
     * ```
     *   Publication 946 Table A-1, 7-year, half-year: 14.29 24.49 17.49
     *   y1  14.29% x 70,000 = 10,003
     *   y2  24.49% x 70,000 = 17,143
     *   y3  17.49% x 70,000 x 0.5 = 6,121.5 -> 6,122     (sold, HY, half-up)
     *
     *   4562 line 22 (this year alone)                          6,122
     *   4797 col (e) all three years                           33,268
     *        col (f) 70,000 + 0                                70,000
     *        col (g) 30,000 + 33,268 - 70,000                  -6,732   <- a §1231 LOSS
     *        line 18b                                          -6,732
     *
     *   Sch C  line  7 gross receipts (1099-NEC box 1)         35,000
     *          line  8 advertising                             -9,000
     *          line 13 Form 4562 line 22                       -6,122
     *          line 31                                         19,878
     *   Sch 1  line  3                                         19,878
     *          line  4 Form 4797 line 18b                      -6,732
     *          line 10                                         13,146
     *   1040   line  8                                         13,146
     * ```
     *
     * **The year-of-sale rounding is a TIE, and that is deliberate**: 17.49%
     * of $700.00 is exactly $122.43, and half of it is $61.215 — the one
     * fractional half-cent in this whole fixture set. `halfUp` rounds it away
     * from zero to $61.22, and a truncating implementation would give $61.21
     * and move printed Schedule C line 31 and Schedule 1 line 4 in opposite
     * directions by a cent each.
     *
     * The control below, which withholds the disposal, is what makes this
     * evidence about the BLOCK rather than about the register.
     */
    storedProgramRoutesADisposalBlockAndComputesFormFortySevenNinetySeven: () => {
        const result = runTwin(founderWithDisposalSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 13146n,
            '$198.78 of Schedule C profit less $67.32 of §1231 loss on Schedule 1 line 4')
        assertEq(cents('1040 line 9'), 13146n, 'and it is the whole of total income')
        assertEq(cents('1040 line 11a'), 13146n, 'AGI = $131.46')
        assertEq(cents('1040 line 25b'), 4000n, 'the §3406 backup withholding is untouched')
    },
    /**
     * THE CONTROL: the SAME stored filer with the register that has NO
     * disposal — the leaf two above — reaches $159.97 instead. The two
     * differ by the disposal alone, and in BOTH directions at once: Schedule 1
     * line 4 appears, and printed Schedule C line 13 changes because the
     * laptop is two recovery years older and takes Step 3's half-year disposal
     * fraction.
     */
    theSameStoredFounderWithNoDisposalReachesTheOtherFigure: () => {
        const result = runTwin(founderWithRegisterSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        assertEq(renderedCents(result)('1040 line 8'), 15997n,
            'no Form 4797, and a first-year laptop rather than a sold one')
    },
    // THE CONTROL: the SAME filer with the two business documents withheld.
    // Everything goes to zero, and the return still computes — so the leaf
    // above is evidence about the DOCUMENTS rather than about the profile.
    theSameStoredFilerWithoutTheBusinessDocumentsComputesZeros: () => {
        const result = runTwin([subjectFounderProfile])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 0n)
        assertEq(cents('1040 line 9'), 0n)
        assertEq(cents('1040 line 25b'), 0n)
        assertEq(cents('1040 line 34'), 0n)
    },
    /**
     * ★ **THE ROUTING LEAF FOR `vnd.fjs.rental_property`.** The stored program
     * classifies the property, files it in `rentalProperties`, and printed
     * Schedule E line 26 reaches Schedule 1 line 5 and therefore 1040 line 8.
     *
     * Every figure hand-computed off the printed page: rents $9,600.00 (line 3)
     * less $1,200.00 of taxes (line 16) less $350.00 of repairs (line 14) is
     * line 20 = $1,550.00, so line 21 and line 26 are **$8,050.00**. The
     * standard deduction for a single filer in TY2025 is $15,750.00, so
     * taxable income floors at zero and nothing is owed — which is the correct
     * answer and not an absence of one.
     *
     * The control below, which withholds the property, is what makes this a
     * statement about the ROUTE rather than two unrelated numbers.
     */
    storedProgramRoutesTheRentalPropertyAndComputesScheduleEPartI: () => {
        const result = runTwin(landlordSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 805000n, '$9,600.00 less $1,550.00, through Schedule 1 line 5')
        assertEq(cents('1040 line 9'), 805000n, 'and it is the whole of total income')
        assertEq(cents('1040 line 11a'), 805000n, 'AGI = $8,050.00')
        assertEq(cents('1040 line 15'), 0n, 'taxable income floors at zero under the $15,750.00 standard deduction')
    },
    // THE CONTROL: the SAME filer with the property withheld. Everything goes
    // to zero and the return still computes, so the leaf above is evidence
    // about the DOCUMENT rather than about the profile.
    theSameStoredLandlordWithoutThePropertyComputesZeros: () => {
        const result = runTwin([subjectLandlordProfile])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 0n)
        assertEq(cents('1040 line 9'), 0n)
        assertEq(cents('1040 line 11a'), 0n)
    },
    /**
     * * **THE ROUTING LEAF FOR `vnd.fjs.farm`.** The stored program classifies
     * the farm, files it in `farmForms`, and printed Schedule F line 34 reaches
     * Schedule 1 line 6 — and printed Schedule SE line 1a, which is the half a
     * routing leaf checking 1040 line 8 alone would miss entirely.
     *
     * Every figure hand-computed off the printed pages, and the same arithmetic
     * `fjs/form1040/core`'s own Schedule F leaf sets out line by line:
     *
     * ```
     *  Schedule F  34  sales of raised products     40,000.00
     *  Schedule 1   6  Schedule F line 34           40,000.00
     *  Schedule SE 1a  Schedule F line 34           40,000.00
     *              4a  92.35% of 40,000.00          36,940.00
     *              12  12.4% + 2.9% of 36,940.00     5,651.82
     *              13  one half                      2,825.91
     *  1040         8  Schedule 1 line 10           40,000.00
     *              10  Schedule 1 line 26            2,825.91
     *              11a 40,000.00 - 2,825.91         37,174.09
     *              23  Schedule 2 line 4             5,651.82
     * ```
     *
     * The control below, which withholds the farm, is what makes this a
     * statement about the ROUTE rather than four unrelated numbers.
     */
    storedProgramRoutesTheFarmAndComputesScheduleF: () => {
        const result = runTwin(farmerSubjects)
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 4000000n, 'Schedule F line 34, through Schedule 1 line 6')
        assertEq(cents('1040 line 9'), 4000000n, 'and it is the whole of total income')
        assertEq(cents('1040 line 10'), 282591n, 'the deductible half of self-employment tax')
        assertEq(cents('1040 line 11a'), 3717409n, 'AGI = $37,174.09')
        assertEq(cents('1040 line 23'), 565182n,
            '$5,651.82 of self-employment tax — the destination a 1040-line-8 assertion misses')
    },
    /**
     * ★ **THE §461(l) CHAIN THROUGH THE STORED PROGRAM, and the field no line
     * of the 1040 carries.** The same farmer with a losing year: $40,000.00 of
     * raised products against $90,000.00 of feed.
     *
     * ```
     *  Schedule F  34  = 9 - 33                      -50,000.00
     *  Schedule 1   6  Schedule F line 34            -50,000.00
     *  Form 461    14  the trade-or-business net     -50,000.00
     *  Form 461    15  single threshold              313,000.00
     *  Form 461    16  = 14 + 15                     263,000.00   allowed in full
     *  Schedule 1  8p  no excess business loss             0.00
     *  1040         8  Schedule 1 line 10            -50,000.00
     *  Form 8995   16  carried to 2026               -50,000.00
     * ```
     *
     * The last line is the one this leaf exists for.
     * `qualifiedBusinessLossCarryforward` rides beside `line16Method` rather
     * than inside `lines`, because `lines` is Form 1040 lines 1a through 37 and
     * this is a line of a different form — so no assertion over `lines` can see
     * it, and rendering it as a hardcoded `'0.00'` survived the entire suite
     * until this fixture existed. It is the only route §199A(c)(2)'s outbound
     * carryforward has out of this engine, and next year's
     * `priorYearQualifiedBusinessLossCarryforward` is what receives it.
     */
    storedProgramCarriesTheFarmLossAndItsQbiCarryforward: () => {
        const result = runTwin([subjectFarmerProfile, subjectFarmerLossFarm])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), -5000000n, 'the whole $50,000.00 farm loss')
        assertEq(cents('1040 line 11a'), -5000000n, 'and it moves adjusted gross income')
        assertEq(
            cents('1040 line 13a (qualified business income deduction, Form 8995 line 15 '
                + 'or Form 8995-A line 39)'), 0n, 'a loss earns no §199A deduction')
        assertEq(cents('1040 line 23'), 0n, 'and no self-employment tax')
        assertEq(
            centsFromString(result.qualifiedBusinessLossCarryforward.value), -5000000n,
            'Form 8995 line 16 hands the whole loss to 2026')
        assert(
            result.qualifiedBusinessLossCarryforward.rule.includes('Form 8995 line 16'),
            ['the printed line must name itself',
                result.qualifiedBusinessLossCarryforward.rule])
        assert(
            result.qualifiedBusinessLossCarryforward.sources.length > 0,
            ['and cite the farm behind it',
                result.qualifiedBusinessLossCarryforward.sources])
        // THE CONTROL, from the profitable farm above: the SAME field is
        // "0.00" when the year was a profit, so this leaf is a statement about
        // the loss rather than about the field always being filled.
        const profitable = runTwin(farmerSubjects)
        assert(profitable.kind === 'ok', ['expected a computed return', profitable])
        if (profitable.kind !== 'ok') {
            return
        }
        assertEq(
            centsFromString(profitable.qualifiedBusinessLossCarryforward.value), 0n,
            'a profitable farm hands nothing to 2026')
    },
    // THE CONTROL: the SAME filer with the farm withheld. Everything goes to
    // zero and the return still computes, so the leaf above is evidence about
    // the DOCUMENT rather than about the profile.
    theSameStoredFarmerWithoutTheFarmComputesZeros: () => {
        const result = runTwin([subjectFarmerProfile])
        assert(result.kind === 'ok', ['expected a computed return', result])
        if (result.kind !== 'ok') {
            return
        }
        const cents = renderedCents(result)
        assertEq(cents('1040 line 8'), 0n)
        assertEq(cents('1040 line 9'), 0n)
        assertEq(cents('1040 line 11a'), 0n)
        assertEq(cents('1040 line 23'), 0n)
    },
    // ── The routing sweep: one leaf per dispatched dialect that had none ──
    //
    // **What this block is, and what a green suite without it was hiding.**
    // TAX-37 closed `vnd.fjs.1095a` by mutation and wrote down that the same
    // hole stayed open for the other twenty-five dispatched dialects. It was
    // measured rather than estimated: deleting ONE line of
    // {@link routeDocument} at a time and running `npm test` for each of the
    // twenty-six branches, FIFTEEN deletions left all 2,572 proofs green —
    // `vnd.fjs.1099int`, `1099div`, `1099b`, `ssa1099`, `itemized_deductions`,
    // `medical_expenses`, `prior_year_capital_loss`, `adjustments`, `1098e`,
    // `form3921`, `form3922`, `basis_correction`, `k1_1065`, `k1_1120s` and
    // `k1_1041`. Every one of those dialects could have been silently
    // unrouted in production and nothing here would have said so.
    //
    // `fjs/form1040/core`'s own end-to-end leaves cannot see it, and that is
    // the whole point: they hand `form1040Report` a `Form1040Inputs`
    // directly and never travel through a stored document at all. Only a
    // leaf that starts from a SUBJECT can.
    //
    // Each leaf below is paired with the mutation that reddens it, and every
    // expected figure is hand-derived from the printed rules at the leaf,
    // never read out of a run.
    //
    // **The narrowing Phases 25, 26 and 27 each recorded applies to every
    // leaf here too, and they do not close it.** `runTwin` interprets
    // {@link taxReturnReport} — the function TWIN. The literal
    // {@link taxReturnReportSource} is executed only by
    // `tax-return-integration.test.js`, in a real `fjs_run` process.
    //
    // That harness's fixture WAS two W-2s and a 1099-G, so all but three of
    // the SOURCE text's route lines were covered by a `String.includes` and
    // nothing else. It now seeds five more subjects — three Schedule K-1
    // faces, a 1099-INT and a 1099-DIV — with amounts chosen so that every
    // subset sums differently and with per-source `boxPath` assertions, so
    // **eight** of the twenty-eight route lines are genuinely executed.
    // Moving any one of the five to a neighbouring bucket reddens that
    // harness and nothing else in this suite.
    // `fjs/todo/tax-return-report-source-route-lines-unexercised.md` sizes
    // the twenty that remain, and separates the ones that cost a subject from
    // the ones that cost a hand-derived schedule.
    routingSweep: {
        // THE CONTROL for the six portfolio leaves. The same profile with
        // every document withheld: each line they move is zero, and the
        // return still computes. Without it, a leaf asserting `$5,000.00`
        // could not distinguish "the 1099-INT was routed" from "the profile
        // alone produces $5,000.00 of interest somehow".
        theProfileAloneComputesEveryPortfolioLineAtZero: () => {
            const result = runTwin([subjectSweepProfile])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 2b'), 0n)
            assertEq(cents('1040 line 3a'), 0n)
            assertEq(cents('1040 line 3b'), 0n)
            assertEq(cents('1040 line 6a'), 0n)
        },
        // `vnd.fjs.1099int`. Box 1 is taxable interest and 1040 line 2b is
        // where it prints: $5,000.00 of box 1 and nothing else in the store,
        // so line 2b is $5,000.00 exactly. Deleting the twin's
        // `oneZeroNineNineIntDialect` branch drops the document and line 2b
        // returns to the control's zero.
        aStoredFormTenNinetyNineIntReachesLineTwoB: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepInterest])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 2b'), 500000n, '$5,000.00 of box 1 interest')
            // Box 1 is TAXABLE interest; line 2a is the tax-exempt line and
            // this document carries no box 8. Asserted because the two lines
            // are one transposition apart.
            assertEq(cents('1040 line 2a'), 0n)
        },
        // `vnd.fjs.1099div`. Box 1a is the ordinary-dividend total and box 1b
        // is the qualified SUBSET of it, so $1,000.00 prints on line 3b and
        // $400.00 on line 3a — the subset is never added into 3b twice.
        aStoredFormTenNinetyNineDivReachesLinesThreeAAndThreeB: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepDividend])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 3b'), 100000n, '$1,000.00 of box 1a')
            assertEq(cents('1040 line 3a'), 40000n, '$400.00 of box 1b, the qualified subset')
        },
        // `vnd.fjs.ssa1099`. Line 6a is box 5 verbatim; line 6b is §86's
        // eighteen-line worksheet, and for a single filer with $12,000.00 of
        // benefits and NO other income the worksheet's line 5 is half the
        // benefits ($6,000.00), which is below the $25,000.00 base amount —
        // so none of it is taxable. Both halves are asserted, because a
        // wiring that dropped the worksheet and printed 6a on 6b would pass a
        // leaf that only checked 6a.
        aStoredFormSsaTenNinetyNineReachesLineSixA: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepSocialSecurity])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 6a'), 1200000n, '$12,000.00 of box 5 net benefits')
            assertEq(cents('1040 line 6b'), 0n, 'and none of it taxable under §86')
        },
        /**
         * **The unread-field sweep's own, at the PRINTED-LINE layer**
         * (`fjs/todo/stored-but-unread-field-sweep.md`). `vnd.fjs.1099div`
         * box 12 was stored, validated for exactness and read by nothing, so
         * this rendered line was $0.00 for every filer holding a municipal
         * bond FUND rather than the bonds themselves.
         *
         * $3,300.00 of box 12 and nothing else in the store, so printed line
         * 2a is $3,300.00 exactly. Line 2b is asserted at zero alongside it:
         * the tax-exempt and taxable interest lines are one transposition
         * apart, and a leaf that checked only 2a could not tell them apart.
         * Line 3b is asserted at zero for the same reason one box number over
         * — this document carries no box 1a.
         */
        aStoredFormTenNinetyNineDivBoxTwelveReachesLineTwoA: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepExemptDividend])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 2a'), 330000n, '$3,300.00 of box 12 exempt-interest dividends')
            assertEq(cents('1040 line 2b'), 0n, 'box 12 is TAX-exempt, not taxable interest')
            assertEq(cents('1040 line 3b'), 0n, 'and this document carries no ordinary dividend')
            // The rendered line cites the box a reader can go and look at.
            // Without this the leaf would pass on a line 2a that reached
            // $3,300.00 from somewhere else entirely.
            const lineTwoA = assertNotNullish(
                result.lines.find(candidate => candidate.rule === '1040 line 2a'),
                'expected line 2a')
            assert(
                lineTwoA.sources.some(source =>
                    source.documentHash === fixtureSweepExemptDividendHash
                    && source.boxPath === 'box12ExemptInterestDividends'),
                ['expected line 2a to cite the 1099-DIV box 12 behind it', lineTwoA.sources])
        },
        /**
         * **The unread-field sweep's own, second half.** `vnd.fjs.ssa1099`
         * box 6 — the voluntary Form W-4V withholding — was stored and read by
         * nothing, so a retiree was charged tax they had already paid.
         *
         * $810.00 withheld on $9,000.00 of benefits: printed line 25b is
         * $810.00, and line 25a is zero because no W-2 is in the store. Both
         * are asserted, because 25a and 25b are the pair a misrouted
         * withholding term lands between.
         */
        aStoredFormSsaTenNinetyNineBoxSixReachesLineTwentyFiveB: () => {
            const result = runTwin(
                [subjectSweepProfile, subjectSweepSocialSecurityWithholding])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            const cents = renderedCents(result)
            assertEq(cents('1040 line 6a'), 900000n, '$9,000.00 of box 5 net benefits')
            assertEq(cents('1040 line 25b'), 81000n, '$810.00 of box 6 voluntary withholding')
            assertEq(cents('1040 line 25a'), 0n, 'no W-2, so nothing on the wages line')
            assertEq(cents('1040 line 25c'), 0n, 'and nothing on the other-forms line')
            const lineTwentyFiveB = assertNotNullish(
                result.lines.find(candidate => candidate.rule === '1040 line 25b'),
                'expected line 25b')
            assert(
                lineTwentyFiveB.sources.some(source =>
                    source.documentHash === fixtureSweepSocialSecurityWithholdingHash
                    && source.boxPath === 'box6VoluntaryFederalIncomeTaxWithheld'),
                ['expected line 25b to cite the SSA-1099 box 6 behind it',
                    lineTwentyFiveB.sources])
        },
        // `vnd.fjs.k1_1065`. The partner's interest is box FIVE on this face.
        // $700.00, and nothing else in the store, so line 2b is $700.00 — a
        // different figure from the 1099-INT leaf's and from the other two
        // K-1 leaves', so a document routed into the wrong bucket prints the
        // wrong number rather than the right one by coincidence.
        aStoredPartnershipScheduleKOneReachesLineTwoB: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepPartnershipK1])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 2b'), 70000n, '$700.00 of box 5')
        },
        // `vnd.fjs.k1_1120s`. The shareholder's interest is box FOUR.
        aStoredSCorporationScheduleKOneReachesLineTwoB: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepSCorporationK1])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 2b'), 3000n, '$30.00 of box 4')
        },
        // `vnd.fjs.k1_1041`. The beneficiary's interest is box ONE — the box
        // number that is ordinary business income on the other two faces.
        aStoredEstateTrustScheduleKOneReachesLineTwoB: () => {
            const result = runTwin([subjectSweepProfile, subjectSweepEstateTrustK1])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 2b'), 40000n, '$400.00 of box 1')
        },
        // THE CONTROL for the four capital-gains leaves: the same declaring
        // profile with every document withheld computes line 7a at zero.
        theCapitalGainsProfileAloneComputesLineSevenAAtZero: () => {
            const result = runTwin([subjectSweepGainsProfile])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 7a'), 0n)
        },
        // `vnd.fjs.1099b`. One short-term sale: $5,000.00 of proceeds less
        // $3,000.00 of basis is a $2,000.00 gain, which is Schedule D's whole
        // line 16 and therefore 1040 line 7a.
        aStoredFormTenNinetyNineBReachesLineSevenA: () => {
            const result = runTwin([subjectSweepGainsProfile, subjectSweepBrokerage])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 7a'),
                200000n,
                '$5,000.00 of proceeds less $3,000.00 of basis')
        },
        // ★ TAX-38. The SAME dialect through the SAME dispatch branch, but
        // carrying the section 1256 block: box 11's $43,000.00 aggregate
        // becomes Form 6781 line 7, splits into $17,200.00 short-term (line
        // 8, 40%) and $25,800.00 long-term (line 9, 60%), lands on printed
        // Schedule D lines 4 and 11, and recombines to $43,000.00 on line 16
        // and therefore on 1040 line 7a.
        //
        // This is a ROUTING proof, not an arithmetic one: `fjs/form6781` and
        // `fjs/schedule/d` prove the split and the two printed lines. What
        // only this file can prove is that a document arriving from the CAS
        // store as a `vnd.fjs.1099b` blob reaches Form 6781 at all.
        aStoredSectionTwelveFiftySixFormTenNinetyNineBReachesLineSevenA: () => {
            const result = runTwin([
                subjectSweepGainsProfile, subjectSweepSectionTwelveFiftySix,
            ])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 7a'),
                4300000n,
                '$43,000.00 — box 11, split 60/40 by Form 6781 and recombined by Schedule D')
        },
        // ★ And the two blocks on ONE return, through the same branch, ADD:
        // $2,000.00 from the box 1 sale plus $43,000.00 from the section 1256
        // aggregate. Two separate 1099-B documents here rather than one
        // consolidated form, because that is the shape a real broker sends
        // and because it is the case the dispatch branch has to get right —
        // both must land in `brokerageForms` and both must be read, by two
        // different forms, from the same list.
        //
        // $2,000.00 and $43,000.00 are deliberately far apart, so a wiring
        // that dropped either produces a figure this leaf does not accept.
        aBoxOneSaleAndASectionTwelveFiftySixAggregateBothReachLineSevenA: () => {
            const result = runTwin([
                subjectSweepGainsProfile, subjectSweepBrokerage,
                subjectSweepSectionTwelveFiftySix,
            ])
            assert(result.kind === 'ok', ['both blocks must compute together', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 7a'),
                4500000n,
                '$45,000.00 = $2,000.00 of stock gain + $43,000.00 of section 1256 aggregate')
        },
        // `vnd.fjs.prior_year_capital_loss`, with figures that are not zeros.
        //
        // **This dialect already had a fixture and the branch was still
        // deletable**, which is the sharpest lesson in this block: Phase 21's
        // carryover document carries `'0.00'` in all four fields, so the leaf
        // that proves its YEAR exemption asserts the fixture's own unchanged
        // refund either way. A fixture is not coverage.
        //
        // The 2024 Capital Loss Carryover Worksheet, on the four stored
        // figures: prior-year 1040 line 15 was $20,000.00 and prior-year
        // Schedule D line 21 was the $3,000.00 cap taken in full, so nothing
        // was absorbed by a zero-taxable-income year; the short-term loss of
        // $10,000.00 (line 7) less the $1,000.00 long-term gain (line 15) and
        // less the $3,000.00 deducted leaves $6,000.00 of short-term
        // carryover. It arrives on this year's Schedule D line 6, survives to
        // line 16 as a $6,000.00 net loss, and §1211(b) caps the deduction at
        // $3,000.00 on line 21 — so line 7a is NEGATIVE $3,000.00.
        aStoredPriorYearCapitalLossReachesLineSevenA: () => {
            const result = runTwin([subjectSweepGainsProfile, subjectSweepRealCarryover])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 7a'),
                -300000n,
                '$3,000.00 of the $6,000.00 carryover, §1211(b)\'s cap')
        },
        // `vnd.fjs.basis_correction`, and its own control in one leaf. The
        // broker reported $6,000.00 of proceeds against $0.00 of basis
        // because $0.00 is what the employee paid for restricted stock; the
        // correction says the $6,000.00 is already inside Form W-2 box 1. So
        // the corrected return has NO gain, and the uncorrected one has a
        // $6,000.00 one. Both figures are asserted, because a correction that
        // was routed but ignored and one that was never routed at all produce
        // the same line without the pair.
        aStoredBasisCorrectionMovesLineSevenAToZero: () => {
            const corrected = runTwin([
                subjectSweepGainsProfile, subjectSweepCorrectedBrokerage,
                subjectSweepBasisCorrection,
            ])
            assert(corrected.kind === 'ok', ['expected a computed return', corrected])
            if (corrected.kind === 'ok') {
                assertEq(
                    renderedCents(corrected)('1040 line 7a'),
                    0n,
                    'basis corrected to the $6,000.00 already taxed as wages')
            }
            const uncorrected = runTwin([subjectSweepGainsProfile, subjectSweepCorrectedBrokerage])
            assert(uncorrected.kind === 'ok', ['expected a computed return', uncorrected])
            if (uncorrected.kind === 'ok') {
                assertEq(
                    renderedCents(uncorrected)('1040 line 7a'),
                    600000n,
                    'and $6,000.00 of phantom gain without the correction')
            }
        },
        // `vnd.fjs.form3922` — **the one dispatched dialect with no figure of
        // its own on any printed line.** Its only reader in the entire engine
        // is a refusal: an ESPP share sale's ordinary-income component is on
        // the employee's Form W-2, not on the Form 3922, so a stored 3922
        // beside a stored sale is a return this engine cannot price and says
        // so. There is therefore no "computes X" leaf to write for it, and
        // inventing one would be the fake assertion this repository has
        // already paid for four times.
        //
        // The refusal IS the observable, and it is a genuine routing proof:
        // delete the `formThirtyNineTwentyTwoDialect` branch and the document
        // never reaches Form 8949, so the sale computes and this leaf reddens
        // on the `kind` assertion. The second half is the control — the same
        // sale without the 3922 computes the $2,000.00 gain.
        aStoredFormThirtyNineTwentyTwoRefusesTheSaleItCannotPrice: () => {
            const refused = runTwin([
                subjectSweepGainsProfile, subjectSweepBrokerage, subjectSweepEspp,
            ])
            assertEq(refused.kind, 'error', 'a stored Form 3922 beside a sale must refuse')
            if (refused.kind === 'error') {
                // The informative half of the message, not the easy half:
                // WHICH document the reader has to go and look at.
                assert(
                    refused.message.includes(fixtureSweepEsppHash),
                    ['the refusal must name the Form 3922', refused.message])
                assertEq(
                    refused.unmodeled.length,
                    0,
                    'a document-data-sufficiency refusal names no fjs/return/scope kind')
            }
            const control = runTwin([subjectSweepGainsProfile, subjectSweepBrokerage])
            assert(control.kind === 'ok', ['the same sale without the 3922 must compute', control])
            if (control.kind === 'ok') {
                assertEq(renderedCents(control)('1040 line 7a'), 200000n)
            }
        },
        // THE CONTROL for the two deduction leaves. The itemizer's profile
        // with both documents withheld: Schedule A totals nothing, and the
        // line 18 election means nothing is what line 12e prints.
        theItemizerProfileAloneComputesLineTwelveEAtZero: () => {
            const result = runTwin([subjectSweepDeductionProfile])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 12e'), 0n)
        },
        // `vnd.fjs.itemized_deductions`. One $4,200.00 state income tax
        // entry, which is below §164(b)(6)'s $10,000.00 cap and so survives
        // whole to Schedule A line 5e, line 7 and the line 17 total.
        aStoredItemizedDeductionsDocumentReachesLineTwelveE: () => {
            const result = runTwin([subjectSweepDeductionProfile, subjectSweepItemized])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 12e'),
                420000n,
                '$4,200.00 of state income tax, under the $10,000.00 cap')
        },
        // `vnd.fjs.medical_expenses`. §213(a) allows the excess over 7.5% of
        // AGI, and this filer's AGI is zero — no income document at all — so
        // 7.5% of it is zero and the whole $1,000.00 survives to Schedule A
        // line 4. Chosen deliberately over pairing it with wages: with wages
        // the floor eats a small figure entirely, and a leaf asserting zero
        // could not tell a routed document from an unrouted one.
        aStoredMedicalExpensesDocumentReachesLineTwelveE: () => {
            const result = runTwin([subjectSweepDeductionProfile, subjectSweepMedical])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 12e'),
                100000n,
                '$1,000.00 over a 7.5%-of-nothing floor')
        },
        // ── TAX-39: the §162(l) deduction, from stored blobs to a rendered
        // 1040 line ─────────────────────────────────────────────────────────
        //
        // Four documents, three dialects, one deduction. Hand-typed:
        //
        //   Schedule C line 31                                   50,000.00
        //   Schedule 1 line 15 (Schedule SE line 13)              3,532.39
        //   Form 7206 line 1                                      9,600.00
        //   Form 7206 line 2 = min(2,400.00, 1,800.00)            1,800.00
        //   Form 7206 line 14 = min(11,400.00, 46,467.61)        11,400.00
        //   1040 line 10 = 3,532.39 + 11,400.00                  14,932.39
        theSelfEmployedHealthInsuranceDeductionReachesLineTen: () => {
            const result = runTwin([
                subjectHealthProfile, subjectHealthAdjustments, subjectHealthNec,
                subjectHealthBusiness,
            ])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 10'),
                1493239n,
                '$3,532.39 of §164(f) plus $11,400.00 of §162(l)')
            // The long-term care CAP must have survived the whole path. An
            // uncapped $2,400.00 would render $15,532.39, and only asserting
            // the total above would not say which of the two halves was wrong.
            assert(
                renderedCents(result)('1040 line 10') !== 1553239n,
                'the §213(d)(10) cap must not have been lost in the routing')
        },
        // THE CONTROL: the same four documents less the adjustments record.
        // 1040 line 10 falls back to Schedule 1 line 15 alone, which is what
        // says the $11,400.00 above came from the document rather than from
        // anywhere else on this return.
        theSameBusinessWithoutTheAdjustmentsRecordCarriesOnlyTheSectionOneSixFourFHalf: () => {
            const result = runTwin([
                subjectHealthProfile, subjectHealthNec, subjectHealthBusiness,
            ])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 10'), 353239n, 'Schedule 1 line 15 alone')
        },
        // THE CONTROL for the two adjustment leaves.
        theAdjustmentProfileAloneComputesLineTenAtZero: () => {
            const result = runTwin([subjectSweepAdjustmentProfile])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(renderedCents(result)('1040 line 10'), 0n)
        },
        // `vnd.fjs.adjustments`. §62(a)(2)(D) caps the educator-expense
        // deduction at $300.00 per eligible educator; the entry is $300.00
        // exactly, so the cap neither bites nor hides the figure, and
        // Schedule 1 line 11 becomes line 26 becomes 1040 line 10.
        aStoredAdjustmentsDocumentReachesLineTen: () => {
            const result = runTwin([subjectSweepAdjustmentProfile, subjectSweepAdjustments])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 10'),
                30000n,
                '$300.00 of educator expenses, §62(a)(2)(D)')
        },
        // `vnd.fjs.1098e`. §221 allows up to $2,500.00 of student loan
        // interest, phased out above $85,000.00 of MAGI for a single filer.
        // Box 1 is $1,000.00 and this filer's MAGI is zero, so neither limit
        // applies and the whole $1,000.00 reaches Schedule 1 line 21 and
        // 1040 line 10.
        aStoredFormTenNinetyEightEReachesLineTen: () => {
            const result = runTwin([subjectSweepAdjustmentProfile, subjectSweepStudentLoan])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind !== 'ok') {
                return
            }
            assertEq(
                renderedCents(result)('1040 line 10'),
                100000n,
                '$1,000.00 of box 1, under both §221 limits')
        },
        // `vnd.fjs.form3921` — the ISO exercise, and the only one of these
        // dialects whose whole effect is a TAX rather than an income or
        // deduction line.
        //
        // Hand-derived from the printed forms, and worth reading because the
        // figure is the point of the form: 2,000 shares exercised at $5.00
        // when the stock was worth $105.00 is a $200,000.00 §56(b)(3)
        // preference — income never received, in a year the shares may not be
        // sellable. This filer has NO other income, so Form 6251 line 1b is
        // negative $15,750.00 (AGI of nothing less the standard deduction)
        // and line 2a adds the same $15,750.00 straight back, leaving AMTI at
        // the preference alone: $200,000.00. TY2025's single AMT exemption is
        // $88,100.00 and its phase-out does not start until $626,350.00, so
        // the exemption survives whole: $200,000.00 - $88,100.00 =
        // $111,900.00, which is below the $239,100.00 point where the rate
        // steps to 28%, so the tentative minimum tax is 26% of it =
        // $29,094.00. The regular tax is zero (taxable income is zero), so
        // Form 6251 line 11 is the whole $29,094.00 and it reaches 1040 line
        // 17 through Schedule 2 line 2.
        //
        // The control is the profile alone: no document, no preference, no
        // AMT — which also proves the $29,094.00 is the DOCUMENT's and not
        // the declaration's.
        aStoredFormThirtyNineTwentyOneReachesLineSeventeen: () => {
            const result = runTwin([subjectSweepIsoProfile, subjectSweepIso])
            assert(result.kind === 'ok', ['expected a computed return', result])
            if (result.kind === 'ok') {
                const cents = renderedCents(result)
                assertEq(cents('1040 line 15'), 0n, 'no taxable income at all')
                assertEq(cents('1040 line 17'), 2909400n, '$29,094.00 of alternative minimum tax')
                assertEq(cents('1040 line 37'), 2909400n, 'and the whole of it owed')
            }
            const control = runTwin([subjectSweepIsoProfile])
            assert(control.kind === 'ok', ['expected a computed return', control])
            if (control.kind === 'ok') {
                assertEq(renderedCents(control)('1040 line 17'), 0n, 'and none of it without the form')
            }
        },
    },
    // The one mechanical half of the source/twin hand-sync (see the module
    // header): every dialect tag the TWIN dispatches on appears verbatim in
    // the SOURCE text, against a hand-typed count. The twin imports these
    // constants; the source cannot, so it spells them out — this is what
    // stops a rename from quietly desynchronizing the two.
    sourceAndTwinDispatchOnTheSameTwentyNineDialects: () => {
        assertEq(dispatchedDialects.length, expectedDispatchedDialectCount)
        for (const tag of dispatchedDialects) {
            assert(
                taxReturnReportSource.includes(`'${tag}'`),
                ['the stored program source does not dispatch on', tag])
        }
        // The stored program must be importable by a CAS blob: zero imports.
        assert(!taxReturnReportSource.includes('import'), 'the stored program must contain no import')
        // …and it must actually reach the engine through ctx, not through
        // anything else.
        assert(
            taxReturnReportSource.includes('ctx.form1040Report('),
            'the stored program must call the engine through ctx')
    },
    /**
     * The OTHER mechanical half, and it was missing until the Form 461 phase
     * found it the hard way. `runTwin` executes the FUNCTION twin; the source
     * TEXT is executed only by `tax-return-integration.test.js`, in a real
     * process. So a value rendered correctly by the twin and hardcoded in the
     * source passes every leaf in this module — measured, not supposed:
     * replacing the source's
     * `ctx.centsToString(outcome.qualifiedBusinessLossCarryforward.value)` with
     * a literal `'0.00'` left the whole suite green, while the identical
     * mutation to the twin reddened
     * {@link storedProgramCarriesTheFarmLossAndItsQbiCarryforward} at once.
     *
     * Every result field is therefore named here, hand-typed, and each must be
     * rendered from `outcome` in the source rather than written as a constant.
     * `taxYear` is the one exception and is asserted separately: it comes from
     * the profile, not from the engine's outcome.
     */
    everyResultFieldIsRenderedFromTheOutcomeInTheSourceText: () => {
        /** @type {readonly string[]} */
        const renderedFromTheOutcome = [
            'line16Method: outcome.line16Method',
            'ctx.centsToString(outcome.qualifiedBusinessLossCarryforward.value)',
            'outcome.qualifiedBusinessLossCarryforward.rule',
            'outcome.qualifiedBusinessLossCarryforward.sources',
            'outcome.lines.map',
            'ctx.centsToString(line.value)',
        ]
        assertEq(renderedFromTheOutcome.length, 6, 'six hand-typed renderings')
        for (const expression of renderedFromTheOutcome) {
            assert(
                taxReturnReportSource.includes(expression),
                ['the stored program source must render this from the outcome', expression])
        }
        assert(
            taxReturnReportSource.includes('taxYear: profile.value.taxYear'),
            'the tax year comes from the profile, not from the outcome')
    },
}
