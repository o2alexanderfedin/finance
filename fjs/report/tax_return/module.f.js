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
 * dialect belongs in which of `Form1040Inputs`' eleven fields, and decides
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
 * inside the source text**, against a hand-typed count of eleven. That
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
 * - **`vnd.fjs.prior_year_capital_loss` is exempt BY NAME**, for the reason
 *   above: its year is supposed to differ. It is the one exemption, it is
 *   stated at {@link noteYearMismatch}, and
 *   {@link proof.taxYearRefusal.aPriorYearCarryoverIsExemptAndStillComputes}
 *   is the control proving the exemption is real rather than assumed.
 * - **Verified rather than assumed**: all twelve dialects this program routes
 *   into the engine declare `taxYear: number` as a REQUIRED schema field —
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
 * **No re-validation.** A document's bytes are handed to the engine as
 * parsed, because `cas_add`/`evo_add` already validated them against their
 * dialect and `fjs/form1040/core`'s own `Stored<T>` docstring is explicit
 * that nothing there re-validates either (AGENTS.md: one rule, one place).
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
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
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

/** @import { Effect, OperationMap } from 'functionalscript/fjs/effects/module.f.js' */
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
 * @typedef {ReturnProfile | W2 | OneZeroNineNineInt | OneZeroNineNineDiv | OneZeroNineNineB | OneZeroNineNineR | Ssa1099 | ItemizedDeductions | MedicalExpenses | PriorYearCapitalLoss | OneZeroNineNineG | Adjustments | OneZeroNineEightE | OneZeroNineEightT | Credits} EngineDocument
 */

/**
 * `Form1040Inputs` mid-collection: the same thirteen fields, with `profile`
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
 *   readonly adjustmentForms: readonly Stored<Adjustments>[],
 *   readonly studentLoanInterestForms: readonly Stored<OneZeroNineEightE>[],
 *   readonly tuitionForms: readonly Stored<OneZeroNineEightT>[],
 *   readonly creditForms: readonly Stored<Credits>[],
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
    '        adjustmentForms: [],',
    '        studentLoanInterestForms: [],',
    '        tuitionForms: [],',
    '        creditForms: [],',
    '    }',
    '    const runYear = ctx.taxParams.taxYear',
    '    const noteYearMismatch = documentHash => doc => acc => {',
    '        if (acc.yearMismatch !== undefined) { return acc }',
    '        if (doc.dialect === \'vnd.fjs.prior_year_capital_loss\') { return acc }',
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
    '        if (doc.dialect === \'vnd.fjs.adjustments\') { return { ...acc, adjustmentForms: [...acc.adjustmentForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1098e\') { return { ...acc, studentLoanInterestForms: [...acc.studentLoanInterestForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.1098t\') { return { ...acc, tuitionForms: [...acc.tuitionForms, stored] } }',
    '        if (doc.dialect === \'vnd.fjs.credits\') { return { ...acc, creditForms: [...acc.creditForms, stored] } }',
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
    '            adjustmentForms: acc.adjustmentForms,',
    '            studentLoanInterestForms: acc.studentLoanInterestForms,',
    '            tuitionForms: acc.tuitionForms,',
    '            creditForms: acc.creditForms,',
    '        })',
    '        if (outcome.kind === \'error\') {',
    '            return { kind: \'error\', message: outcome.message, unmodeled: outcome.unmodeled }',
    '        }',
    '        return {',
    '            kind: \'ok\',',
    '            taxYear: profile.value.taxYear,',
    '            line16Method: outcome.line16Method,',
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
    adjustmentForms: [],
    studentLoanInterestForms: [],
    tuitionForms: [],
    creditForms: [],
}

/**
 * Routes one parsed document into its `Form1040Inputs` field —
 * {@link taxReturnReportSource}'s own `collect`, typed.
 *
 * Written as an if-chain over the `dialect` discriminant rather than a
 * `{ dialect: fieldName }` lookup table, deliberately: the table form needs
 * a computed key (`{ ...acc, [field]: [...] }`), which no type can express
 * without discarding exactly the per-dialect element type
 * `Form1040Inputs` exists to guarantee. Thirteen explicit branches cost
 * thirteen lines and keep `tsc` checking that a 1099-R never lands in `w2s`.
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
    if (doc.dialect === creditsDialect) { return { ...acc, creditForms: [...acc.creditForms, { documentHash, value: doc }] } }
    return undefined
}

/**
 * Records the FIRST document whose stored tax year is not the year this run
 * computes — {@link taxReturnReportSource}'s own `noteYearMismatch`, typed.
 * See the module header for the whole rule and why refusing is not the same
 * decision as filtering.
 *
 * `vnd.fjs.prior_year_capital_loss` is the ONE exemption, by name: a capital
 * loss carryover records a PRIOR year by definition
 * (`fjs/document/prior_year_capital_loss`'s own docstring — its `taxYear`
 * "names the PRIOR year these four figures come off"), so its year is
 * SUPPOSED to differ and refusing on it would make every carryover
 * unusable.
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
    if (doc.dialect === priorYearCapitalLossDialect) {
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
 * {@link taxReturnReportSource}'s own `render`, typed. The eleven fields are
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
        adjustmentForms: acc.adjustmentForms,
        studentLoanInterestForms: acc.studentLoanInterestForms,
        tuitionForms: acc.tuitionForms,
        creditForms: acc.creditForms,
    })
    if (outcome.kind === 'error') {
        return { kind: 'error', message: outcome.message, unmodeled: outcome.unmodeled }
    }
    return {
        kind: 'ok',
        taxYear: profile.value.taxYear,
        line16Method: outcome.line16Method,
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
    /** @type {(subjects: readonly string[]) => (acc: Collected) => Effect<CasOp, TaxReturnResult>} */
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
 * @type {(subjects: readonly string[]) => OperationMap<CasOp, string>}
 */
const hostMapOver = subjects => ({
    evoList: () => JSON.stringify(subjects),
    evoHead: (/** @type {string} */ subject) => JSON.stringify([`head:${subject}`]),
    evoRevision: (/** @type {string} */ headHash) => JSON.stringify({
        snapshot: assertNotNullish(
            snapshotBySubject[headHash.slice('head:'.length)],
            ['unknown head', headHash]),
    }),
    casRead: (/** @type {string} */ hash) =>
        JSON.stringify(assertNotNullish(documentByHash[hash], ['unknown document hash', hash])),
})

/** The fixture's five subjects, deliberately NOT in sorted order. */
const fixtureSubjects = [subjectW2B, subjectProfile, subjectOutOfScope, subject1099G, subjectW2A]

/** Phase 25's own four subjects, likewise NOT in sorted order. */
const creditsSubjects = [
    subjectCreditsTuition, subjectCreditsW2, subjectCreditsRecord, subjectCreditsProfile,
]

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
 * list shrinking (AGENTS.md's fourth shipped defect), so eleven is written
 * out here and asserted beside the loop.
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
    adjustmentsDialect,
    oneZeroNineEightEDialect,
    oneZeroNineEightTDialect,
    creditsDialect,
]

/** @type {number} */
const expectedDispatchedDialectCount = 15

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
    // What this leaf proves that the direct one cannot: the SOURCE TEXT's own
    // `route` branches for `vnd.fjs.1098t` and `vnd.fjs.credits` are real.
    // Delete either and the credits vanish, because no other fixture in this
    // repository carries a document of either dialect through the stored
    // program.
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
    // The one mechanical half of the source/twin hand-sync (see the module
    // header): every dialect tag the TWIN dispatches on appears verbatim in
    // the SOURCE text, against a hand-typed count. The twin imports these
    // constants; the source cannot, so it spells them out — this is what
    // stops a rename from quietly desynchronizing the two.
    sourceAndTwinDispatchOnTheSameFifteenDialects: () => {
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
}
