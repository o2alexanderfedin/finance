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
 * ## Two scope boundaries this program deliberately does NOT enforce
 *
 * Stated here rather than discovered later, the same way
 * `fjs/report/payer`'s own two-dialect boundary is stated in its header:
 *
 * - **No tax-year filter.** Every active document of a recognized dialect is
 *   handed to the engine, whatever `taxYear` it carries. The naive fix —
 *   keep only documents whose `taxYear` equals the profile's — is
 *   demonstrably WRONG for at least one dialect:
 *   `vnd.fjs.prior_year_capital_loss` carries the PRIOR year by definition
 *   (`fjs/document/prior_year_capital_loss`'s own docstring), so that filter
 *   would silently drop a carryover and overstate the tax. Deciding which
 *   dialects are year-scoped and which are not is a rule about the engine's
 *   inputs, and it belongs beside the engine — not invented inside the first
 *   program that happens to need it.
 * - **No re-validation.** A document's bytes are handed to the engine as
 *   parsed, because `cas_add`/`evo_add` already validated them against
 *   their dialect and `fjs/form1040/core`'s own `Stored<T>` docstring is
 *   explicit that nothing there re-validates either (AGENTS.md: one rule,
 *   one place).
 *
 * What the program DOES refuse, because neither is a scope judgment: a store
 * with **no** active `vnd.fjs.return_profile` document, and a store with
 * **more than one**. A 1040 has exactly one filer; silently picking whichever
 * profile the enumeration happened to reach last is the shape of error this
 * repository exists to make impossible.
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
 * @typedef {ReturnProfile | W2 | OneZeroNineNineInt | OneZeroNineNineDiv | OneZeroNineNineB | OneZeroNineNineR | Ssa1099 | ItemizedDeductions | MedicalExpenses | PriorYearCapitalLoss | OneZeroNineNineG} EngineDocument
 */

/**
 * `Form1040Inputs` mid-collection: the same eleven fields, with `profile`
 * not yet found and a flag for the one ambiguity a second profile creates.
 *
 * `duplicateProfile` is a flag rather than an early return because the walk
 * is a fold — it has nowhere to return to — and because visiting every
 * subject anyway keeps the observed-read set (and therefore the run
 * record's `inputs[]`) an honest account of what the program looked at.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile> | undefined,
 *   readonly duplicateProfile: boolean,
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
 * }} Collected
 */

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
    '    }',
    '    const collect = documentHash => doc => acc => {',
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
    '        return acc',
    '    }',
    '    const render = acc => {',
    '        if (acc.duplicateProfile) {',
    '            return {',
    '                kind: \'error\',',
    '                message: \'more than one active vnd.fjs.return_profile document; a return has exactly one filer\',',
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
}

/**
 * Routes one parsed document into its `Form1040Inputs` field —
 * {@link taxReturnReportSource}'s own `collect`, typed.
 *
 * Written as an if-chain over the `dialect` discriminant rather than a
 * `{ dialect: fieldName }` lookup table, deliberately: the table form needs
 * a computed key (`{ ...acc, [field]: [...] }`), which no type can express
 * without discarding exactly the per-dialect element type
 * `Form1040Inputs` exists to guarantee. Eleven explicit branches cost eleven
 * lines and keep `tsc` checking that a 1099-R never lands in `w2s`.
 * @type {(documentHash: string) => (doc: EngineDocument) => (acc: Collected) => Collected}
 */
const collectDocument = documentHash => doc => acc => {
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
    return acc
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
                    return walk(rest)(collectDocument(rev.snapshot)(doc)(acc))
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

const subjectProfile = 'tax-return-subject-profile'
const subjectW2A = 'tax-return-subject-w2-a'
const subjectW2B = 'tax-return-subject-w2-b'
const subject1099G = 'tax-return-subject-1099g'
const subjectOutOfScope = 'tax-return-subject-out-of-scope'

/** @type {Readonly<Record<string, EngineDocument | { readonly dialect: string }>>} */
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
}

/** @type {Readonly<Record<string, string>>} */
const snapshotBySubject = {
    [subjectProfile]: fixtureProfileHash,
    [subjectW2A]: fixtureW2AHash,
    [subjectW2B]: fixtureW2BHash,
    [subject1099G]: fixture1099GHash,
    [subjectOutOfScope]: fixtureOutOfScopeHash,
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
]

/** @type {number} */
const expectedDispatchedDialectCount = 11

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
    // The one mechanical half of the source/twin hand-sync (see the module
    // header): every dialect tag the TWIN dispatches on appears verbatim in
    // the SOURCE text, against a hand-typed count. The twin imports these
    // constants; the source cannot, so it spells them out — this is what
    // stops a rename from quietly desynchronizing the two.
    sourceAndTwinDispatchOnTheSameElevenDialects: () => {
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
