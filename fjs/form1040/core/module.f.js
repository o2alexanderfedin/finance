/**
 * Form 1040 lines 1a through 37 (TAX-05): income, adjusted gross income, the
 * standard deduction, taxable income, the tax itself, credits, payments, and
 * the refund or amount owed — every line a {@link ReportLine} citing the
 * documents it derived from (ROADMAP criterion 1).
 *
 * ## The property that makes this honest rather than decorative
 *
 * **A legitimately zero line still cites a document.** The taxpayer declared
 * no dividends, so line 3b is `0n` — with the return profile's own
 * `declaredKinds` box as its source, because that declaration is what makes
 * the zero true. A line that returns `0n` for an input this engine cannot
 * model is a different thing entirely and never reaches here: the scope guard
 * (`fjs/return/scope`) refuses the WHOLE report first (10-CONTEXT.md Decision
 * 2). The distinction is carried entirely by the declared kind set, which is
 * why the profile is load-bearing rather than convenient — see
 * {@link profileDeclaredZeroLine}.
 *
 * ## Why a RECORD keyed by the printed line label
 *
 * `line1a`, `line1z`, `line11b` … — not an array. `tsconfig` sets
 * `noUncheckedIndexedAccess`, so an array would make every line read
 * `ReportLine | undefined`; and TAX-15 asks for the printed line numbers to
 * BE the names, so a diff against the form face is possible. A record gives
 * both at once.
 *
 * ## Where the source union matters
 *
 * Line 15 is the input to every line-16 branch, so {@link unionSources} is
 * what makes line 16 transitively cite every document that fed it (PROV-02).
 * Concatenating non-empty tuples is non-empty, so the union can never violate
 * PROV-01's guarantee — but `tsc` cannot see that through `Array.prototype`,
 * which is why {@link unionSources} ends in an `assert` rather than a cast.
 *
 * ## Line 16 is never bracket arithmetic
 *
 * TAX-03 exists because the obvious implementation — run the taxable income
 * through the marginal brackets — is wrong for every return the printed Tax
 * Table covers, by up to a few dollars per return, and wrong SILENTLY. Line 16
 * here is whatever `fjs/tax/line16`'s four-way dispatcher returns, and the
 * report carries the selected method out with it, so a caller can assert which
 * branch produced the number rather than re-deriving it and hoping.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { applyWholeDollarElection } from '../../report/line/module.f.js'
import { dispatchLine16 } from '../../tax/line16/module.f.js'
import { dialect as w2Dialect } from '../../document/w2/module.f.js'
import { dialect as oneZeroNineNineIntDialect } from '../../document/1099int/module.f.js'
import { dialect as oneZeroNineNineDivDialect } from '../../document/1099div/module.f.js'
import { dialect as oneZeroNineNineBDialect } from '../../document/1099b/module.f.js'
import { dialect as oneZeroNineNineRDialect } from '../../document/1099r/module.f.js'
import { dialect as ssa1099Dialect } from '../../document/ssa1099/module.f.js'
import { dialect as itemizedDeductionsDialect } from '../../document/itemized_deductions/module.f.js'
import { qdcgt } from '../../tax/line16/qdcgt/module.f.js'
import { sdtw } from '../../tax/line16/sdtw/module.f.js'
import { socialSecurityBenefitsWorksheet } from '../../tax/ssb/module.f.js'
import {
    dialect as returnProfileDialect,
    kindVocabulary,
    validate as validateReturnProfile,
} from '../../return/profile/module.f.js'
import { classifyScope } from '../../return/scope/module.f.js'
import { deductionChoice } from '../../tax/deduction/module.f.js'
import { individualFilingStatuses, taxParamsByYear } from '../../tax/params/module.f.js'
import { scheduleD } from '../../schedule/d/module.f.js'
import { scheduleOneA } from '../../schedule/1a/module.f.js'
import { scheduleA } from '../../schedule/a/module.f.js'
import { scheduleOne } from '../../schedule/1/module.f.js'
import { scheduleTwo } from '../../schedule/2/module.f.js'
import { scheduleThree } from '../../schedule/3/module.f.js'
import { form8812 } from '../../form8812/module.f.js'
import { baseTaxForAmount } from '../../tax/table/module.f.js'

/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { OneZeroNineNineB } from '../../document/1099b/module.f.js' */
/** @import { OneZeroNineNineR } from '../../document/1099r/module.f.js' */
/** @import { Ssa1099 } from '../../document/ssa1099/module.f.js' */
/** @import { ItemizedDeductions } from '../../document/itemized_deductions/module.f.js' */
/** @import { MedicalExpenses } from '../../document/medical_expenses/module.f.js' */
/** @import { Kind, ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Line16Method } from '../../tax/line16/module.f.js' */
/** @import { UnmodeledKind } from '../../return/scope/module.f.js' */
/** @import { ScheduleDOutcome } from '../../schedule/d/module.f.js' */
/** @import { ScheduleAOutcome } from '../../schedule/a/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it: the CAS hash it is addressed by,
 * paired with its ALREADY-VALIDATED value. Nothing here re-validates — a blob
 * that never passed its dialect's `validate` has no business reaching a report
 * line, and re-checking here would be the second copy of a rule that rots
 * (AGENTS.md: one rule, one place).
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything lines 1a-15 read. The profile is a single document (a return has
 * exactly one); W-2s, 1099-INTs, 1099-DIVs and 1099-Bs are lists, because a
 * taxpayer may hold any number of each — which is precisely what makes
 * criterion 5's ten-document rounding demonstration expressible on a real
 * line.
 *
 * `dividendForms`/`brokerageForms` are Plan 12.1-04's own widening
 * (12.1-PATTERNS.md, `fjs/schedule/b`'s `ScheduleBInputs` precedent): lines
 * 3a/3b read dividend documents unconditionally, and Schedule D reads both
 * when `capitalGainsOrLosses` is declared.
 *
 * `retirementForms`/`socialSecurityForms` are Plan 13-02's own widening
 * (Slice 1, TAX-10): lines 4a/4b/5a/5b read `vnd.fjs.1099r` documents,
 * routed to IRA vs. pension by each document's own `box7bIraSepSimple`
 * checkbox (13-RESEARCH.md Pitfall 4), and line 6a reads `vnd.fjs.ssa1099`
 * documents, unconditionally, exactly like `dividendForms` already does for
 * 3a/3b.
 *
 * `itemizedDeductionForms`/`medicalExpenseForms` are Plan 13-07's own
 * widening (Slice 3, TAX-13): line 12e reads `vnd.fjs.itemized_deductions`
 * and `vnd.fjs.medical_expenses` documents, flattened into
 * `fjs/schedule/a`'s own `Stored<ItemizedEntry>`/`Stored<MedicalExpenseEntry>`
 * shape and fed to `scheduleA`, whose line 17 total then feeds
 * `deductionChoice`. Lists, per this typedef's own established convention,
 * even though `vnd.fjs.itemized_deductions`/`vnd.fjs.medical_expenses` are
 * each a single running record per taxpayer per year (`fjs/document
 * /itemized_deductions`'s own docstring) — a taxpayer holds at most one of
 * each, but the shape stays a list for the same reason `profile` alone is
 * not: consistency with every other document field here.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly w2s: readonly Stored<W2>[],
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly brokerageForms: readonly Stored<OneZeroNineNineB>[],
 *   readonly retirementForms: readonly Stored<OneZeroNineNineR>[],
 *   readonly socialSecurityForms: readonly Stored<Ssa1099>[],
 *   readonly itemizedDeductionForms: readonly Stored<ItemizedDeductions>[],
 *   readonly medicalExpenseForms: readonly Stored<MedicalExpenses>[],
 * }} Form1040Inputs
 */

/**
 * The exact cents sum of one box over a set of documents, with one
 * {@link Source} per PRESENT box.
 *
 * `sources` is a PLAIN, possibly-EMPTY array — deliberately not a
 * `ReportLine`. A taxpayer who declared wages but holds no W-2 produces zero
 * readings, and a `ReportLine` with no sources cannot exist at the type level
 * (PROV-01). {@link documentLine} is where that case turns into a
 * profile-declared zero instead, so the emptiness is handled once, at the one
 * place that has the profile in hand.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

// ── The source union ─────────────────────────────────────────────────────────

/**
 * The deduplication key for a {@link Source}: its document hash and box path,
 * joined by a SINGLE SPACE.
 *
 * The separator is safe by construction rather than by hope: a CAS hash is
 * hex (plus an algorithm prefix) and a `boxPath` is a JavaScript identifier
 * naming a dialect field, so neither can contain a space, and therefore no two
 * distinct `(documentHash, boxPath)` pairs can render to the same key. Reading
 * the same box of the same document twice is one citation; reading two boxes
 * of one document, or one box of two documents, is two.
 * @type {(source: Source) => string}
 */
const sourceKey = source => `${source.documentHash} ${source.boxPath}`

/**
 * The union of every input line's sources: concatenated, deduplicated on
 * {@link sourceKey}, in FIRST-SEEN order, and still a non-empty tuple.
 *
 * **Why the `assert` and not a cast.** Concatenating non-empty tuples is
 * non-empty, and deduplication only ever removes DUPLICATES — so the result is
 * non-empty for a type-level reason, and PROV-01's guarantee survives the
 * union. `tsc` cannot see that through `Array.prototype.filter`, whose result
 * is a plain array. `noUncheckedIndexedAccess` is on and AGENTS.md bans a cast
 * or a `!` over the indexed read, so binding the head and narrowing it with
 * `assert` is the only compliant way to convince the compiler of something
 * that is true. The `assert` is therefore unreachable in practice, and that is
 * the point: it documents the invariant at the one place it could ever break.
 *
 * The input is itself a non-empty tuple, so "union of no lines" is not a case
 * a caller can construct.
 * @type {(lines: readonly [ReportLine, ...(readonly ReportLine[])]) => readonly [Source, ...(readonly Source[])]}
 */
export const unionSources = lines => {
    const concatenated = lines.flatMap(line => line.sources)
    // First-seen order: keep a source only at the index where its key first
    // appears. `findIndex` over the concatenation, never a mutable seen-set.
    const deduplicated = concatenated.filter((source, index) =>
        concatenated.findIndex(seen => sourceKey(seen) === sourceKey(source)) === index)
    const [first, ...rest] = deduplicated
    assert(
        first !== undefined,
        ['a union of non-empty source tuples cannot be empty', lines.length],
    )
    return [first, ...rest]
}

// ── Reading money boxes off documents ────────────────────────────────────────

/**
 * The exact cents sum of ONE box across a set of documents, with one
 * {@link Source} per PRESENT box.
 *
 * **DOC-11: an absent box is ABSENT, never zero.** A form that left a box
 * blank contributes nothing and cites nothing — it is skipped, and no source
 * is emitted for it. Defaulting it to `'0.00'` would give the same VALUE, so
 * the only thing that can ever observe the difference is the source COUNT.
 * That is what `line2b.absentBoxIsSkippedNeverDefaulted` asserts.
 *
 * The source's `value` is the box's raw decimal string EXACTLY as stored,
 * never re-formatted through `centsToString` — a citation that reformats what
 * it cites is no longer quoting the document (`fjs/report/line`'s `Source`
 * docstring, EXACT-05).
 *
 * **Round the total, never the items** (i1040gi p23). The sum is taken over
 * exact cents, once; nothing here rounds. The whole-dollar election is applied
 * to the finished line, by `applyWholeDollarElection`, and
 * `criterionFiveRoundSumOverTenInterestDocuments` prices the difference at $4
 * on ten $1.39 amounts.
 * @type {<T>(documents: readonly Stored<T>[]) => (boxPath: string) => (read: (document: T) => string | undefined) => BoxSum}
 */
const sumBoxOverDocuments = documents => boxPath => read => {
    const sources = documents.flatMap(document => {
        const printed = read(document.value)
        return printed === undefined
            ? []
            : [{ documentHash: document.documentHash, boxPath, value: printed }]
    })
    return {
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

/**
 * Adds two {@link BoxSum}s — line 2b is boxes 1 and 3 of the same forms, so it
 * is two box sums added, not one box read twice.
 * @type {(a: BoxSum) => (b: BoxSum) => BoxSum}
 */
const addBoxSums = a => b => ({
    value: a.value + b.value,
    sources: [...a.sources, ...b.sources],
})

/**
 * A line whose value came from documents — falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied a reading.
 *
 * Zero readings means either "the taxpayer holds no such form" or "every such
 * form left the box blank". Both are honestly zero, and both must still cite
 * something, so both cite the declaration that says the amount is zero.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (sum: BoxSum) => ReportLine}
 */
const documentLine = profile => rule => sum => {
    const [first, ...rest] = sum.sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value: sum.value, sources: [first, ...rest], rule }
}

/**
 * A line that is zero **because the taxpayer declared no such income**, citing
 * the return profile's own `declaredKinds` box as its provenance.
 *
 * That declaration IS the rule this line implements. A zero with no source
 * would be indistinguishable from a silently omitted line — which is the exact
 * failure mode TAX-16 exists to prevent (T-10-09-01) — and a zero citing a
 * kind the engine cannot model never reaches here at all, because
 * `fjs/return/scope`'s guard refuses the whole report first.
 *
 * The source `value` renders the declared kind list into JSON text: the box's
 * content is an array, and quoting it is what lets a reader check for
 * themselves that the kind really is absent.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => ReportLine}
 */
const profileDeclaredZeroLine = profile => rule => ({
    value: 0n,
    sources: [{
        documentHash: profile.documentHash,
        boxPath: 'declaredKinds',
        value: JSON.stringify(profile.value.declaredKinds),
    }],
    rule,
})

/**
 * A line that is the SUM of other lines, with the union of their sources — the
 * shape of lines 1z, 9 and 14.
 * @type {(rule: string) => (lines: readonly [ReportLine, ...(readonly ReportLine[])]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

// ── Line 12d: the four age/blindness boxes ───────────────────────────────────

/**
 * The four line-12d checkboxes, in the order the printed form lists them.
 * Typed via `@type {const}` — not a wider `keyof ReturnProfile` — so
 * `profile[name]` resolves to exactly `true | undefined` rather than the union
 * of every profile field's type, the same reason `fjs/return/profile`'s own
 * `moneyBoxFields` is written this way.
 *
 * DOC-12: a checkbox is `option(true)`, so CHECKED is the key's PRESENCE and
 * unchecked is its absence — there is no `false` to test against. The box
 * count `fjs/tax/deduction` receives is therefore how many of these four keys
 * are present, and nothing else. The per-status MAXIMUM is enforced there, and
 * the spouse-box eligibility rule at ingest, in `fjs/return/profile`; this list
 * only says which boxes exist.
 */
const agedOrBlindBoxNames = /** @type {const} */ ([
    'taxpayerBornBeforeJan2_1961',
    'taxpayerIsBlind',
    'spouseBornBeforeJan2_1961',
    'spouseIsBlind',
])

/**
 * Recovers the profile's `filingStatus` — stored as a plain `string`, because
 * a JSON blob's field is a string — as the union `fjs/tax/params` is keyed by,
 * by FINDING it in that module's own stored list.
 *
 * **This is a narrowing, not a second validation rule.** The RULE that a
 * filing status must be one this engine has parameters for lives in
 * `fjs/return/profile`'s `checkReferences` check 1, and a value reaching this
 * module has already passed it, so `undefined` here is unreachable for a
 * validated profile. It exists because AGENTS.md bans a cast, and returning
 * the MEMBER OF THE STORED LIST that matched is stronger than asserting a
 * predicate over the incoming string: the value that flows onward came from
 * `fjs/tax/params`, not from the blob.
 * @type {(status: string) => IndividualFilingStatus | undefined}
 */
const storedFilingStatusNamed = status =>
    individualFilingStatuses.find(candidate => candidate === status)

// ── Lines 1a through 15 ──────────────────────────────────────────────────────

/**
 * Form 1040 lines 1a through 15, each a {@link ReportLine}, keyed by the
 * printed line label — plus, since Plan 12.1-04, the `kind: 'ok'` tag that
 * makes this the OK arm of a union with {@link Form1040Error} (mirroring
 * {@link Form1040TaxAndPaymentLines}'s own return-type shape one function
 * over), and four bookkeeping fields that are dispatcher INPUTS, never
 * printed lines: `filingScheduleD` and the four `scheduleD1{5,6,8,9}Cents`
 * fields Schedule D computed, threaded to `dispatchLine16`'s call site in
 * {@link form1040TaxAndPaymentLines}.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1a: ReportLine,
 *   readonly line1b: ReportLine,
 *   readonly line1c: ReportLine,
 *   readonly line1d: ReportLine,
 *   readonly line1e: ReportLine,
 *   readonly line1f: ReportLine,
 *   readonly line1g: ReportLine,
 *   readonly line1h: ReportLine,
 *   readonly line1i: ReportLine,
 *   readonly line1z: ReportLine,
 *   readonly line2a: ReportLine,
 *   readonly line2b: ReportLine,
 *   readonly line3a: ReportLine,
 *   readonly line3b: ReportLine,
 *   readonly line4a: ReportLine,
 *   readonly line4b: ReportLine,
 *   readonly line5a: ReportLine,
 *   readonly line5b: ReportLine,
 *   readonly line6a: ReportLine,
 *   readonly line6b: ReportLine,
 *   readonly line7a: ReportLine,
 *   readonly line8: ReportLine,
 *   readonly line9: ReportLine,
 *   readonly line10: ReportLine,
 *   readonly line11a: ReportLine,
 *   readonly line11b: ReportLine,
 *   readonly line12e: ReportLine,
 *   readonly line13a: ReportLine,
 *   readonly line13b: ReportLine,
 *   readonly line14: ReportLine,
 *   readonly line15: ReportLine,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly scheduleD18Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 * }} Form1040IncomeLines
 */

/**
 * Computes Form 1040 lines 1a through 15 for an in-scope return.
 *
 * Every `1b`-`1i`, `8`, `10`, `13a` and `13b` line is a
 * {@link profileDeclaredZeroLine}: zero only because the corresponding kind
 * was not declared. Had it been declared, `fjs/return/scope` would already
 * have refused the whole report, so "declared but unmodeled" never reaches
 * this function. Lines 3a, 3b and 7a are no longer in that group as of Plan
 * 12.1-04; lines 4a, 4b, 5a, 5b and 6a are no longer in it as of Plan 13-02
 * (Slice 1, TAX-10) — see the comments above their construction below. Line
 * 6b is never a placeholder at all: it is the 18-line Social Security
 * Benefits Worksheet's own output (`fjs/tax/ssb`).
 *
 * `taxParamSet` is read by exactly one line — 12e, the standard deduction. It
 * is threaded through the outer arrow rather than looked up here, so the tax
 * year in force is the caller's decision and never an implicit default.
 *
 * The return type is now a UNION with {@link Form1040Error}: a Schedule D
 * absent-basis (or undecided-category) refusal must stop the WHOLE report
 * before line 7a — or any later line — is ever built, mirroring
 * {@link form1040TaxAndPaymentLines}'s own error-arm shape one function over.
 * This is the SECOND, EARLIER error-arm short-circuit this file needed
 * (12.1-PATTERNS.md's own finding): the pre-existing one, `line16Outcome`'s,
 * runs too late, inside `form1040TaxAndPaymentLines`, which executes AFTER
 * this function returns.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => Form1040IncomeLines | Form1040Error}
 */
export const form1040IncomeLines = taxParamSet => inputs => {
    const {
        profile, w2s, interestForms, dividendForms, brokerageForms,
        retirementForms, socialSecurityForms,
        itemizedDeductionForms, medicalExpenseForms,
    } = inputs
    const declaredZero = profileDeclaredZeroLine(profile)
    const fromDocuments = documentLine(profile)

    // The filing status, computed HERE (rather than only at line 12e, as
    // before Plan 12.1-04) because Schedule D's loss-cap threshold
    // ($3,000.00/$1,500.00 MFS) needs it too, and one rule belongs in one
    // place.
    const status = storedFilingStatusNamed(profile.value.filingStatus)
    assert(
        status !== undefined,
        [
            'the return profile carries a filing status this engine has no parameters for',
            profile.value.filingStatus,
        ],
    )

    // 12.1-CONTEXT.md Decision 1.6: `filingScheduleD` is read VERBATIM off
    // the DECLARED KIND, never off document presence — the same discipline
    // `fjs/schedule/b`'s foreign-account fields already use. `declaredKindsOf`
    // and `fjs/return/scope`'s `classifyScope` are independent: the former
    // only narrows `profile.value.declaredKinds` against the frozen
    // vocabulary, which this phase's reclassification never touches, so this
    // check is safe regardless of what the scope guard currently does with
    // the result.
    const filingScheduleD = declaredKindsOf(profile).includes('capitalGainsOrLosses')
    /** @type {ScheduleDOutcome | undefined} */
    const scheduleDOutcome = filingScheduleD
        ? scheduleD({ status, brokerageForms, dividendForms })
        : undefined
    // The new, EARLIER error-arm guard: an absent-basis (or undecided-
    // category) refusal from Form 8949/Schedule D stops the WHOLE return
    // before ANY line is built — not merely line 7a — threaded exactly as
    // `line16Outcome`'s error arm already is, one function over. This is a
    // document-data-sufficiency refusal (12.1-CONTEXT.md Decision 2.6), never
    // a `fjs/return/scope` kind, so `unmodeled` is empty rather than naming
    // anything.
    if (scheduleDOutcome !== undefined && scheduleDOutcome.kind === 'error') {
        return { kind: 'error', message: scheduleDOutcome.message, unmodeled: [] }
    }
    // Narrowed a second, fully explicit way (never relying on `tsc` to carry
    // the negation of the `if` above across the rest of this function): only
    // an `ok` outcome — or no outcome at all, when Schedule D was never filed
    // — can reach here.
    const scheduleDOk = scheduleDOutcome !== undefined && scheduleDOutcome.kind === 'ok'
        ? scheduleDOutcome
        : undefined

    // 1a — total from Form(s) W-2 box 1.
    const line1a = fromDocuments('1040 line 1a')(
        sumBoxOverDocuments(w2s)('box1WagesTipsOtherCompensation')(
            w2 => w2.box1WagesTipsOtherCompensation))
    const line1b = declaredZero('1040 line 1b') // household employee wages
    const line1c = declaredZero('1040 line 1c') // unreported tips
    const line1d = declaredZero('1040 line 1d') // Medicaid waiver payments
    const line1e = declaredZero('1040 line 1e') // dependent care benefits
    const line1f = declaredZero('1040 line 1f') // adoption benefits
    const line1g = declaredZero('1040 line 1g') // Form 8919 wages
    const line1h = declaredZero('1040 line 1h') // other earned income
    const line1i = declaredZero('1040 line 1i') // nontaxable combat pay election
    // 1z = 1a + 1b + ... + 1h. **Line 1i is NOT a summand** — the printed form
    // stops the addition at 1h, because the combat-pay election is an amount
    // the taxpayer ELECTS to treat as earned income for the EIC and the
    // additional child tax credit, not wages to be taxed. Including it is the
    // obvious mistake, so it is named here rather than left to be inferred
    // from the absence of a term.
    const line1z = totalLine('1040 line 1z')([
        line1a, line1b, line1c, line1d, line1e, line1f, line1g, line1h,
    ])

    // 2a — tax-exempt interest (1099-INT box 8); 2b — taxable interest
    // (1099-INT box 1 plus box 3).
    const line2a = fromDocuments('1040 line 2a')(
        sumBoxOverDocuments(interestForms)('box8TaxExemptInterest')(
            form => form.box8TaxExemptInterest))
    const line2b = fromDocuments('1040 line 2b')(addBoxSums(
        sumBoxOverDocuments(interestForms)('box1InterestIncome')(
            form => form.box1InterestIncome))(
        sumBoxOverDocuments(interestForms)('box3UsSavingsBondsAndTreasuryInterest')(
            form => form.box3UsSavingsBondsAndTreasuryInterest)))

    // 3a/3b — qualified/ordinary dividends, read UNCONDITIONALLY from stored
    // 1099-DIVs, exactly like 1a/2a/2b already read from documents with no
    // declaration gate (Plan 12.1-04's own <objective>): a MODELED line's job
    // is to report what the documents say, and `declaredKinds` exists to gate
    // REFUSALS for kinds this engine cannot yet compute, not to gate an
    // individual already-computable line. A taxpayer who never declares
    // `qualifiedDividends` but holds a real 1099-DIV gets their REAL figure —
    // strictly more correct than the `declaredZero` this replaces, never less.
    const line3a = fromDocuments('1040 line 3a')(
        sumBoxOverDocuments(dividendForms)('box1bQualifiedDividends')(
            div => div.box1bQualifiedDividends))
    const line3b = fromDocuments('1040 line 3b')(
        sumBoxOverDocuments(dividendForms)('box1aTotalOrdinaryDividends')(
            div => div.box1aTotalOrdinaryDividends))
    // Decision 3.3/5.1 — the IRA-deduction circularity refusal, threaded
    // BEFORE line 4a is built, exactly like the Schedule D absent-basis
    // guard above: a document-data-sufficiency/interaction refusal
    // (12.1-CONTEXT.md Decision 2.6's category), never a `fjs/return/scope`
    // kind, so `unmodeled` is empty rather than naming anything. The SSB
    // worksheet's own line 6 sums Schedule 1 line 20 (the IRA deduction)
    // among its summands, and Pub. 590-A Worksheet 1-1's own MAGI depends on
    // Form 1040 line 6b, which this function has not yet produced when the
    // profile makes this declaration — the genuine fixed point 13-RESEARCH.md
    // §2 confirms and 13-CONTEXT.md Decision 3.3 refuses rather than models.
    if (profile.value.iraDeductionDeclared === true) {
        return {
            kind: 'error',
            message: 'the IRA deduction (Schedule 1 line 20) cannot be computed while taxable '
                + "Social Security benefits are also present, because Pub. 590-A Worksheet 1-1's "
                + 'own MAGI depends on Form 1040 line 6b, which this worksheet has not yet '
                + 'produced; this engine does not model the fixed point (no phase yet)',
            unmodeled: [],
        }
    }

    // 4a/4b — IRA distributions, 5a/5b — pensions and annuities. Routed by
    // EACH DOCUMENT'S OWN `box7bIraSepSimple` checkbox (13-RESEARCH.md
    // Pitfall 4, the IRS's own Form 1099-R box 7 convention) — checked
    // routes that document's box1/box2a to 4a/4b, unchecked routes the same
    // document to 5a/5b. Never summed uniformly across every 1099-R: a
    // taxpayer holding both an IRA and a pension 1099-R must see two
    // different, correctly-routed totals.
    const iraRetirementForms = retirementForms.filter(form => form.value.box7bIraSepSimple === true)
    const pensionRetirementForms = retirementForms.filter(form => form.value.box7bIraSepSimple !== true)
    const line4a = fromDocuments('1040 line 4a')(
        sumBoxOverDocuments(iraRetirementForms)('box1GrossDistribution')(
            form => form.box1GrossDistribution))
    const line4b = fromDocuments('1040 line 4b')(
        sumBoxOverDocuments(iraRetirementForms)('box2aTaxableAmount')(
            form => form.box2aTaxableAmount))
    const line5a = fromDocuments('1040 line 5a')(
        sumBoxOverDocuments(pensionRetirementForms)('box1GrossDistribution')(
            form => form.box1GrossDistribution))
    const line5b = fromDocuments('1040 line 5b')(
        sumBoxOverDocuments(pensionRetirementForms)('box2aTaxableAmount')(
            form => form.box2aTaxableAmount))

    // 7a — capital gain or (loss). Filing Schedule D: the THREE-WAY routed
    // figure `fjs/schedule/d` already computed (gain / zero / capped loss),
    // cited to Schedule D's own sources — falling back to the profile's
    // `declaredKinds` box on the (structurally possible) case of a declared
    // Schedule D filer with no actual 1099-B/1099-DIV box read, via
    // {@link documentLine}, exactly like every other document-sourced line.
    // Not filing Schedule D: capital gain distributions alone (1099-DIV box
    // 2a), read unconditionally — dispatcher branches 2c/2d/2e's own
    // `capitalGainDistributionsCents` input, correct in BOTH cases per this
    // plan's own `<interfaces>` note.
    //
    // Computed HERE, ahead of line 6a/6b below, because the Social Security
    // Benefits Worksheet's own line 3 needs 7a's value (and line 8's) —
    // 13-RESEARCH.md §9's ordering step 1/3. The RETURNED line list still
    // carries every line in PRINTED order regardless of the order these
    // `const`s are computed in.
    const line7a = scheduleDOk === undefined
        ? fromDocuments('1040 line 7a')(
            sumBoxOverDocuments(dividendForms)('box2aTotalCapitalGainDistr')(
                div => div.box2aTotalCapitalGainDistr))
        : fromDocuments('1040 line 7a')({
            value: scheduleDOk.line7aCapitalGainOrLoss,
            sources: scheduleDOk.sources,
        })
    // 8/10 — Schedule 1 (`fjs/schedule/1`, Plan 13-11/13-12, TAX-14): Part
    // I's total additional income (line10) feeds 1040 line 8, Part II's
    // total adjustments (line26) feeds 1040 line 10 — ONE `scheduleOne(...)`
    // call, never two, so the two 1040 lines can never read two different
    // Schedule 1 computations. `scheduleOneAdditionalIncome`/
    // `scheduleOneAdjustments` stay in `unmodeledKindRefusals`
    // (`fjs/return/scope`) for the whole of this phase — every field
    // `scheduleOne` returns is a `profileDeclaredZeroLine`, so both totals
    // are `0n` for every profile this engine can otherwise compute (this
    // plan's own objective: citation granularity, not a value change).
    const scheduleOneResult = scheduleOne(profile)
    const line8 = {
        value: scheduleOneResult.line10.value,
        sources: scheduleOneResult.line10.sources,
        rule: '1040 line 8',
    }   // additional income, Schedule 1 Part I total (line10)

    // 6a — total Social Security/Railroad Retirement benefits (SSA-1099/
    // RRB-1099 box 5), read UNCONDITIONALLY from stored documents, exactly
    // like 3a/3b already read from `dividendForms` with no declaration gate.
    const line6a = fromDocuments('1040 line 6a')(
        sumBoxOverDocuments(socialSecurityForms)('box5NetBenefits')(
            form => form.box5NetBenefits))
    // 6b — taxable Social Security benefits: the 18-line worksheet
    // (`fjs/tax/ssb`), fed every other income line its own line 3 sums
    // (1z, 2b, 3b, 4b, 5b, 7a, 8) plus tax-exempt interest (line 2a, the
    // add-back). `mfsLivedWithSpouseAtAnyTimeInYear` is gated on the filing
    // STATUS here, never passed through unconditionally — the worksheet's
    // own `assert` refuses a `true` value paired with any other status, and
    // gating here means a profile that declares the flag inconsistently
    // (e.g. without MFS) is read as `false` rather than crashing the whole
    // computation on an internal invariant (Rule 2 — input validation at the
    // boundary, not an unhandled throw one module in). Schedule 1 stays
    // unmodeled-refused for the whole of this phase (13-CONTEXT.md Decisions
    // 3.2/6.1), so `scheduleOneAdjustmentsTotalCents` is always `0n` from
    // this, the only real caller this phase — genuinely read by the
    // worksheet, never hardcoded there (`fjs/tax/ssb`'s own docstring).
    const mfsLivedWithSpouseAtAnyTimeInYear = status === 'marriedFilingSeparately'
        && profile.value.mfsLivedWithSpouseAtAnyTimeInYear === true
    const ssbResult = socialSecurityBenefitsWorksheet(taxParamSet)({
        status,
        mfsLivedWithSpouseAtAnyTimeInYear,
        totalSsaAndRrbBox5Cents: line6a.value,
        otherIncomeLine3Cents:
            line1z.value + line2b.value + line3b.value + line4b.value
            + line5b.value + line7a.value + line8.value,
        taxExemptInterestCents: line2a.value,
        scheduleOneAdjustmentsTotalCents: 0n,
    })
    // Cites line6a (worksheet line 1) plus every income line that fed
    // worksheet line 3 (1z, 2b, 3b, 4b, 5b, 7a, 8) plus line2a (worksheet
    // line 4, the tax-exempt-interest add-back) — every input the worksheet
    // actually read, per PROV-02.
    const line6b = {
        value: ssbResult.line18,
        sources: unionSources([
            line6a, line1z, line2a, line2b, line3b, line4b, line5b, line7a, line8,
        ]),
        rule: '1040 line 6b',
    }

    // 9 — total income. The eight summands the printed form names, in its
    // order; the sources are the union of all eight.
    const line9 = totalLine('1040 line 9')([
        line1z, line2b, line3b, line4b, line5b, line6b, line7a, line8,
    ])
    // 10 — Schedule 1 Part II's own total (line26), from the SAME
    // `scheduleOneResult` computed at line 8, above — never a second,
    // independently stale `scheduleOne(...)` call.
    const line10 = {
        value: scheduleOneResult.line26.value,
        sources: scheduleOneResult.line26.sources,
        rule: '1040 line 10',
    } // adjustments, Schedule 1 Part II total (line26)

    // 11a/11b — adjusted gross income. **New on the 2025 form**: the 2024 form
    // had a single line 11; the 2025 face states AGI on page 1 (11a) and
    // restates it on page 2 (11b). 11b is the same figure with the same
    // provenance under a different printed name, so it restates rather than
    // recomputes — a second computation could disagree with the first.
    const line11a = {
        value: line9.value - line10.value,
        sources: unionSources([line9, line10]),
        rule: '1040 line 11a',
    }
    const line11b = { ...line11a, rule: '1040 line 11b' }

    // 12e — the standard deduction, OR the itemized total, whichever
    // `deductionChoice` (`fjs/tax/deduction`, Plan 13-07, TAX-13) selects.
    //
    // Research found that PROV-01's `ReportLine` could not express this line
    // AT ALL: `sources` is a non-empty tuple of `{documentHash, boxPath,
    // value}`, and the standard deduction derives from a filing status and a
    // set of checked boxes, which no document dialect modelled. The return
    // profile (10-CONTEXT.md Decision 4) is what fixes that — it is a real CAS
    // document with a real hash, so line 12e cites the profile's own
    // `filingStatus` box and one box per checked 12d checkbox. Phase 9's
    // `tsc`-level guarantee is left untouched rather than widened, and no
    // synthetic hash is minted. `status` itself is computed once, near the
    // top of this function, because Schedule D's loss-cap threshold needs it
    // too (one rule, one place).
    const checkedAgedOrBlindBoxes = agedOrBlindBoxNames.filter(
        name => profile.value[name] !== undefined)
    /** @type {Source} */
    const filingStatusSource = {
        documentHash: profile.documentHash,
        boxPath: 'filingStatus',
        value: status,
    }
    /** @type {readonly Source[]} */
    const twelveDBoxSources = checkedAgedOrBlindBoxes.map(name =>
        ({ documentHash: profile.documentHash, boxPath: name, value: 'true' }))
    // `fjs/schedule/a`'s own `ScheduleAInput.itemizedEntries`/
    // `medicalExpenseEntries` shape: one `Stored<>` per ENTRY, sharing the
    // hash of the ONE document each entry came from — Schedule A takes
    // flattened entries, not raw documents, exactly like it reads them
    // itself (`fjs/schedule/a`'s own `sumEntriesByLineTag`).
    const itemizedEntries = itemizedDeductionForms.flatMap(form =>
        form.value.entries.map(entry => ({ documentHash: form.documentHash, value: entry })))
    // `reimbursed` is spread conditionally, never carried as `string |
    // undefined` on an always-present key: `exactOptionalPropertyTypes`
    // distinguishes an OMITTED optional key from one explicitly set to
    // `undefined`, and `fjs/schedule/a`'s own `MedicalExpenseEntry.reimbursed?`
    // is the former. Mirrors that module's own `medicalEntry` fixture
    // builder's identical conditional spread.
    const medicalExpenseEntries = medicalExpenseForms.flatMap(form =>
        form.value.entries.map(entry => ({
            documentHash: form.documentHash,
            value: {
                datePaid: entry.datePaid,
                provider: entry.provider,
                category: entry.category,
                amount: entry.amount,
                ...(entry.reimbursed === undefined ? {} : { reimbursed: entry.reimbursed }),
            },
        })))
    // Schedule A itself (13-06) — a STANDALONE computation over the
    // taxpayer-asserted entries and AGI, reading NOTHING about which figure
    // eventually wins. `agiCents` is `line11b.value`, already computed above.
    const scheduleAResult = scheduleA(taxParamSet)({
        status,
        agiCents: line11b.value,
        itemizedEntries,
        medicalExpenseEntries,
        profile,
    })
    // CR-01/WR-04 (13-REVIEW.md): a document-data-sufficiency refusal from
    // Schedule A (a mutually-exclusive line 5a election, or an unrecognized
    // itemized-deductions `lineTag`) stops the WHOLE return before any
    // further line is built — threaded exactly like the Schedule D
    // absent-basis guard and the IRA-deduction guard above, one function
    // over: `unmodeled: []`, since this names no `fjs/return/scope` kind.
    if (scheduleAResult.kind === 'error') {
        return { kind: 'error', message: scheduleAResult.message, unmodeled: [] }
    }
    // The standard-vs-itemized comparison itself (13-CONTEXT.md Decision
    // 2.4): `deductionChoice` owns the decision, this wiring only feeds it
    // both figures and takes the winner. `itemizedCents` is Schedule A's own
    // line 17 grand total; `itemizeEvenThoughLessThanStandardDeduction` is
    // read VERBATIM off the profile (Decision 2.5's line 18 election),
    // exactly like the three age/blindness/dependent exceptions above it are.
    const deductionChoiceResult = deductionChoice(taxParamSet)({
        status,
        agedOrBlindBoxes: checkedAgedOrBlindBoxes.length,
        // Exceptions 1-3 (i1040gi p34). Each is `option(true)` on the
        // profile, so CHECKED is the key's presence — never a stored
        // `false` (DOC-12). Reading any of these as a hardcoded `false`
        // would leave every one of `fjs/tax/deduction`'s own proofs green,
        // because that module is called correctly there and only miswired
        // here; the two dependent leaves below exist for exactly that.
        claimedAsDependent: profile.value.claimedAsDependent !== undefined,
        spouseItemizes: profile.value.spouseItemizes !== undefined,
        dualStatusAlien: profile.value.dualStatusAlien !== undefined,
        earnedIncomeCents: profile.value.earnedIncome === undefined
            ? 0n
            : centsFromString(profile.value.earnedIncome),
        itemizedCents: scheduleAResult.line17,
        itemizeEvenThoughLessThanStandardDeduction:
            profile.value.itemizeEvenThoughLessThanStandardDeduction === true,
    })
    // The itemized-deductions document's own hash, cited ONLY when present
    // (an itemizing return) — line 12e cites what was COMPARED, not only
    // what won (Decision 2.4): the filing-status/12d-box sources above are
    // the STANDARD side of the comparison; these are the ITEMIZED side.
    // Mirrors `fjs/schedule/a`'s own `sumEntriesByLineTag`'s per-entry
    // `Source` shape exactly, so the same box path a reader would find on
    // Schedule A's own citation is what appears here too.
    /** @type {readonly Source[]} */
    const itemizedDeductionsSources = itemizedEntries.map(entry => ({
        documentHash: entry.documentHash,
        boxPath: `entries[lineTag=${entry.value.lineTag}]`,
        value: entry.value.amount,
    }))
    /**
     * The filing-status box, then one box per CHECKED 12d checkbox, then
     * (when the return itemizes) one box per itemized-deductions entry.
     * Annotated as the non-empty tuple `ReportLine.sources` demands: a
     * spread of a plain array into an array literal infers a plain array,
     * and the head element is what makes the tuple non-empty.
     * @type {readonly [Source, ...(readonly Source[])]}
     */
    const twelveESources = [filingStatusSource, ...twelveDBoxSources, ...itemizedDeductionsSources]
    const line12e = {
        value: deductionChoiceResult.chosen === 'itemized'
            ? deductionChoiceResult.itemized
            : deductionChoiceResult.standard,
        sources: twelveESources,
        rule: '1040 line 12e',
    }
    const line13a = declaredZero('1040 line 13a') // QBI deduction, Form 8995
    // 13b — additional deductions from Schedule 1-A (Plan 13-03/13-04,
    // TAX-09): the senior deduction's continuous 6% phase-out, Parts I/V/VI.
    // Read UNCONDITIONALLY, exactly like lines 3a/3b/4a-6b above — a MODELED
    // line reports what the facts say; `declaredKinds` gates the WHOLE-
    // RETURN refusal for `seniorAndOtherScheduleOneADeductions`
    // (`fjs/return/scope`), never this individual line. For a profile that
    // declares the kind while it is still unmodeled, this wiring is
    // UNREACHABLE: `form1040Report`'s own `classifyScope` call refuses the
    // whole return before `form1040IncomeLines` (this function) ever runs —
    // this line only computes for a return already in scope, at which point
    // the zero it would otherwise be is instead the real Schedule 1-A
    // figure.
    //
    // `taxpayerHasValidSsnAndBornBefore1961Jan2`/`spouseHasValidSsnAnd...`
    // are NOT yet profile fields of their own — derived from the EXISTING
    // age boxes (`taxpayerBornBeforeJan2_1961`/`spouseBornBeforeJan2_1961`,
    // already on the profile and already read by line 12e above), with a
    // valid SSN ASSUMED TRUE for a declared filer: no SSN-validity field
    // exists yet for the primary taxpayer/spouse themselves (Schedule
    // 8812's `dependents` array is the first place SSN validity becomes a
    // per-person fact, a later wave).
    const scheduleOneAResult = scheduleOneA(taxParamSet)({
        status,
        agiCents: line11b.value,
        taxpayerHasValidSsnAndBornBefore1961Jan2: profile.value.taxpayerBornBeforeJan2_1961 === true,
        spouseHasValidSsnAndBornBefore1961Jan2: profile.value.spouseBornBeforeJan2_1961 === true,
        profile,
    })
    const line13b = {
        value: scheduleOneAResult.partVI.line38,
        sources: unionSources([line11b]),
        rule: '1040 line 13b',
    }
    const line14 = totalLine('1040 line 14')([line12e, line13a, line13b])

    // 15 — taxable income. The printed form says "If zero or less, enter -0-",
    // so the floor is the form's, not a defensive clamp: a negative taxable
    // income is not a smaller tax, it is a figure the 1040 has no space for.
    const line15BeforeFloor = line11b.value - line14.value
    const line15 = {
        value: line15BeforeFloor > 0n ? line15BeforeFloor : 0n,
        sources: unionSources([line11b, line14]),
        rule: '1040 line 15',
    }

    return {
        kind: 'ok',
        line1a, line1b, line1c, line1d, line1e, line1f, line1g, line1h, line1i, line1z,
        line2a, line2b,
        line3a, line3b,
        line4a, line4b,
        line5a, line5b,
        line6a, line6b,
        line7a,
        line8,
        line9,
        line10,
        line11a, line11b,
        line12e,
        line13a, line13b,
        line14,
        line15,
        filingScheduleD,
        scheduleD15Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line15,
        scheduleD16Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line16,
        scheduleD18Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line18,
        scheduleD19Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line19,
    }
}

// ── Lines 16 through 37 ──────────────────────────────────────────────────────

/**
 * Form 1040 lines 16 through 37, each a {@link ReportLine}, keyed by the
 * printed line label — the tax, the credits, the payments, and the refund or
 * amount owed that closes the return.
 *
 * The same record-not-array reasoning as {@link Form1040IncomeLines}, and the
 * same printed-label naming (TAX-15), so page 2 of the form face can be
 * diffed against this list.
 * @typedef {{
 *   readonly line16: ReportLine,
 *   readonly line17: ReportLine,
 *   readonly line18: ReportLine,
 *   readonly line19: ReportLine,
 *   readonly line20: ReportLine,
 *   readonly line21: ReportLine,
 *   readonly line22: ReportLine,
 *   readonly line23: ReportLine,
 *   readonly line24: ReportLine,
 *   readonly line25a: ReportLine,
 *   readonly line25b: ReportLine,
 *   readonly line25c: ReportLine,
 *   readonly line25d: ReportLine,
 *   readonly line26: ReportLine,
 *   readonly line27a: ReportLine,
 *   readonly line28: ReportLine,
 *   readonly line29: ReportLine,
 *   readonly line30: ReportLine,
 *   readonly line31: ReportLine,
 *   readonly line32: ReportLine,
 *   readonly line33: ReportLine,
 *   readonly line34: ReportLine,
 *   readonly line35a: ReportLine,
 *   readonly line36: ReportLine,
 *   readonly line37: ReportLine,
 * }} Form1040TaxAndPaymentLines
 */

/**
 * The WHOLE return, as one outcome — 10-CONTEXT.md Decision 2.
 *
 * An unmodeled declared input makes the entire report an error result naming
 * what is unmodeled, and **the error arm carries no line list**. A caller
 * cannot accidentally render a partial 1040, because there is nothing to
 * render — strictly stronger than returning an empty array, which a renderer
 * would happily draw as a form of zeros.
 *
 * ## `lines?: undefined` is load-bearing, and the obvious form does NOT work
 *
 * `[FINDING, this plan's Task 2 mutation 3, reproduced independently by the
 * phase owner]` The natural way to write this — simply OMIT `lines` from the
 * error member — states the property but does not enforce it. This plan
 * predicted that returning `{ kind: 'error', message, unmodeled, lines }` would
 * fail to compile. **It compiled clean**, twice: with an empty array and with a
 * genuinely partial line list.
 *
 * The mechanism is worth stating exactly, because the half that is easy to
 * check is the half that gives the reassuring answer. Excess-property checking
 * applies only to a FRESH object literal in a directly contextually-typed
 * position, and there it does fire. All four spellings below were compiled with
 * the `lines?: undefined` line deleted:
 *
 * - `/** @type {Form1040Outcome} *\/ const o = { kind: 'error', …, lines: [] }`
 *   — **`TS2353`, rejected.** This is why the type was believed safe.
 * - `({ ...refusal, lines })` — a SPREAD is not fresh: **compiled clean.**
 * - the same literal bound to a local and then returned: **compiled clean**
 *   (with `kind` pinned — see the trap below).
 * - this module's own shape, where the literal is returned from an arrow whose
 *   type is checked against the `@type` annotation on the `const` rather than
 *   at the `return` itself: **compiled clean.**
 *
 * So the guarantee held for exactly one spelling — and not the one this file
 * uses. An error outcome really could have carried a full set of computed
 * lines: a partial 1040 returned under a refusal, which is precisely what
 * 10-CONTEXT.md Decision 2 exists to prevent.
 *
 * **The trap in probing this**, recorded because it cost a probe here: written
 * naively, `const o = { kind: 'error', … }` widens `kind` to `string`, so the
 * return fails with `TS2322` — an error about literal-type widening that has
 * nothing to do with `lines`. Read as "the guard works", it would have closed
 * the investigation on a passing probe that proved something else entirely.
 * The `kind` must be pinned with `@type {const}` before the bound-local case
 * says anything at all.
 *
 * Declaring `lines?: undefined` here turns it from an excess-property question
 * into an ASSIGNABILITY one: `readonly ReportLine[]` is not assignable to
 * `undefined`, so the refusing arm cannot carry a line list at all — which is
 * what T-10-10-02 asked for and what the omission alone did not deliver. The
 * runtime shape is unchanged: nothing ever sets the key, and
 * `theErrorArmCarriesNoLinesFieldAtAll` asserts its absence with
 * `Object.hasOwn`.
 *
 * The cost, stated so it is not rediscovered as a bug: reading `outcome.lines`
 * WITHOUT narrowing is now legal and yields `readonly ReportLine[] |
 * undefined` where it used to be a compile error. That is the weaker of the
 * two halves — a caller still cannot obtain a partial list, because none can
 * be constructed — and `strictNullChecks` still forces the `undefined` to be
 * handled.
 *
 * The discriminated `kind` is `fjs/report/guard`'s `RunOutcome` shape and
 * `fjs/return/scope`'s `ScopeOutcome` shape, deliberately: one refusal
 * vocabulary for the whole engine, not a third parallel one.
 *
 * `line16Method` rides on the `ok` arm because a report that states a tax
 * without stating HOW it was figured cannot be checked. Two of line 16's four
 * methods produce the same cents on a return with no preferential income, so
 * the number alone cannot say which engine ran.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly lines: readonly ReportLine[],
 *   readonly line16Method: Line16Method,
 * } | {
 *   readonly kind: 'error',
 *   readonly message: string,
 *   readonly unmodeled: readonly UnmodeledKind[],
 *   readonly lines?: undefined,
 * }} Form1040Outcome
 */

/**
 * The ERROR member of {@link Form1040Outcome}, extracted so the functions that
 * can only refuse can say exactly that in their own return type — the same
 * device, and the same reason, as `fjs/return/scope`'s `ScopeError`.
 * @typedef {Extract<Form1040Outcome, { readonly kind: 'error' }>} Form1040Error
 */

/**
 * The printed NAME of each line-16 method, for line 16's `rule` string.
 *
 * A `Record` over the method union rather than a lookup with a fallback: the
 * keys are the union's own members, so a method added to `fjs/tax/line16`
 * without a name here stops the build at `tsc`. There is deliberately no
 * default string — a default is how a new branch would ship reported as
 * something it is not.
 * @type {Record<Line16Method, string>}
 */
const line16MethodNames = {
    taxTable: 'Tax Table',
    taxComputationWorksheet: 'Tax Computation Worksheet',
    qdcgt: 'Qualified Dividends and Capital Gain Tax Worksheet',
    scheduleDTaxWorksheet: 'Schedule D Tax Worksheet',
    foreignEarnedIncomeTaxWorksheet: 'Foreign Earned Income Tax Worksheet',
    form8615: 'Form 8615',
    scheduleJ: 'Schedule J',
}

/**
 * Line 22 — the tax on line 18 less the nonrefundable credits on line 21,
 * `max(18 - 21, 0n)`. The printed form says "If zero or less, enter -0-", so
 * the floor is the form's own instruction, not a defensive clamp.
 *
 * **Why line 22 is a named function while lines 34 and 37 are written inline.**
 * The floor is UNREACHABLE through a whole report in this phase, and that is a
 * property of the scope guard rather than of this line: line 21 is `19 + 20`,
 * both of which are profile-declared zeros, because a return declaring
 * `childTaxCreditOrOtherDependents` (line 19) or
 * `scheduleThreeNonrefundableCredits` (line 20) is refused whole. So line 21
 * is always `0n` here and `18 - 21` can never go negative — a neighbouring
 * rule ABSORBS the floor exactly the way `fjs/tax/line16/qdcgt`'s line 3 guard
 * is absorbed by the `min` below it (AGENTS.md, "the equivalent mutant"). A
 * proof driven only through the report could therefore never watch this floor
 * work, and deleting it would leave the suite green. Naming the rule puts it
 * in one place a proof can call directly, which is what
 * `line22.creditsExceedingTaxFloorAtZero` does. Phase 13's Schedule 8812 and
 * Schedule 3 are what make it reachable end to end.
 * @type {(line18: ReportLine) => (line21: ReportLine) => ReportLine}
 */
const line22TaxLessNonrefundableCredits = line18 => line21 => {
    const difference = line18.value - line21.value
    return {
        value: difference > 0n ? difference : 0n,
        sources: unionSources([line18, line21]),
        rule: '1040 line 22',
    }
}

/**
 * One of the return profile's own money boxes as a {@link BoxSum} — present
 * means one citation at that box carrying the box's raw decimal string;
 * ABSENT means no reading at all.
 *
 * DOC-11 governs the absent case: an absent box is absent, never a stored
 * `'0.00'`. Emitting a citation quoting `'0.00'` at a box the taxpayer left
 * blank would put a value in the report's provenance that no document
 * contains. {@link documentLine} turns the no-reading case into a
 * profile-declared zero instead, so the line still cites the profile — the
 * same document, a different box, and an honest one.
 * @type {(profile: Stored<ReturnProfile>) => (boxPath: 'line26EstimatedTaxPayments' | 'line35aRefundRequested' | 'line36AppliedToNextYear') => BoxSum}
 */
const profileMoneyBox = profile => boxPath => {
    const printed = profile.value[boxPath]
    return printed === undefined
        ? { value: 0n, sources: [] }
        : {
            value: centsFromString(printed),
            sources: [{ documentHash: profile.documentHash, boxPath, value: printed }],
        }
}

/**
 * Form 1040 lines 16 through 37 for an in-scope return, given lines 1a-15.
 *
 * Refuses — as the WHOLE report's outcome, never as a line — when line 16's
 * dispatcher refuses. See the comment at line 16 for why that arm is
 * unreachable today and why it is not dead code.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => (income: Form1040IncomeLines) => { readonly kind: 'ok', readonly tax: Form1040TaxAndPaymentLines, readonly line16Method: Line16Method } | Form1040Error}
 */
const form1040TaxAndPaymentLines = taxParamSet => inputs => income => {
    const { profile, w2s, interestForms, dividendForms, brokerageForms, retirementForms } = inputs
    const declaredZero = profileDeclaredZeroLine(profile)
    const fromDocuments = documentLine(profile)
    const status = storedFilingStatusNamed(profile.value.filingStatus)
    assert(
        status !== undefined,
        [
            'the return profile carries a filing status this engine has no parameters for',
            profile.value.filingStatus,
        ],
    )

    // 16 — the tax. As of Plan 12.1-04, dividend income and (for a taxpayer
    // who can reach it) Schedule D capital gains are REAL, non-zero facts fed
    // to the dispatcher — `income.line3a`/`income.line7a` are no longer
    // `declaredZero` placeholders, and `income.filingScheduleD`/the four
    // `income.scheduleD1{5,6,8,9}Cents` fields are Schedule D's own routed
    // output. Only the three level-0 wrapper forms (2555/8615/Schedule J) and
    // Form 4952 remain always-absent this phase — no kind for any of the four
    // is in scope. A declared-Schedule-D return whose Schedule D lines 18/19
    // are non-zero still refuses today: `fjs/return/scope`'s six-kind
    // reclassification (Plan 12.1-04 Task 2) and `fjs/tax/line16`'s own
    // branch-2a computation (also Task 2) are what make that branch compute
    // instead, landed in the SAME commit as this wiring's own atomic
    // transition. The dispatcher still receives every field as a FACT rather
    // than a pre-decided method, because TAX-03's whole point is that the
    // selection is made in one place from the printed conditions.
    //
    // WHAT LINE 16 DOES NOT INCLUDE. `[VERIFIED: i1040gi.pdf p34, "Line 16
    // Tax"]` — line 16 is a SUM, not merely the dispatch result: "Include in
    // the total on the entry space on line 16 all of the following taxes that
    // apply." Its six add-ons — Forms 8814 and 4972, the section 962 election,
    // an education-credit recapture, Form 8621 line 16e and Form 8978 line 14 —
    // are each a declared kind that refuses the whole report (`fjs/return/scope`).
    // An engine that models line 16 as "the dispatch result" and silently omits
    // the add-ons is exactly TAX-16's failure mode: every line above 16 agrees
    // with the taxpayer's own return, line 16 is quietly short, and nothing in
    // the report says why. That is what those nine vocabulary entries are for.
    const line16Outcome = dispatchLine16(taxParamSet)({
        status,
        taxableIncomeCents: income.line15.value,
        qualifiedDividendsCents: income.line3a.value,
        capitalGainDistributionsCents: income.line7a.value,
        filingScheduleD: income.filingScheduleD,
        scheduleD15Cents: income.scheduleD15Cents,
        scheduleD16Cents: income.scheduleD16Cents,
        scheduleD18Cents: income.scheduleD18Cents,
        scheduleD19Cents: income.scheduleD19Cents,
        filingForm4952: false,
        form4952Line4gCents: 0n,
        form4952Line4eCents: 0n,
        filingForm2555: false,
        form8615Applies: false,
        scheduleJElected: false,
    })
    // The refusing arm, returned as the WHOLE report's outcome (Decision 2).
    //
    // `tsc` is what forces this to be handled: `Line16Outcome` is a union and
    // reading `.cents` without narrowing does not compile. It is UNREACHABLE
    // today — every input that could select a refusing arm is a declared kind
    // the scope guard already refuses — and it is deliberately not deleted as
    // dead code. Phase 12 brings the brokerage documents that make Schedule D
    // line 19 non-zero for a return that is otherwise in scope, and on that day
    // this arm starts firing. The type is what keeps the intervening year
    // honest: nobody can quietly turn line 16 into "the number" without
    // deleting this branch on purpose.
    if (line16Outcome.kind === 'error') {
        return {
            kind: 'error',
            message: line16Outcome.message,
            unmodeled: line16Outcome.unmodeled,
        }
    }
    const line16 = {
        value: line16Outcome.cents,
        sources: unionSources([income.line15]),
        rule: `1040 line 16 (${line16MethodNames[line16Outcome.method]})`,
    }
    // 17/23 — Schedule 2 (`fjs/schedule/2`, Plan 13-11/13-12, TAX-14): Part
    // I's total tax (line3) feeds 1040 line 17, Part II's total other taxes
    // (line21) feeds 1040 line 23 — ONE `scheduleTwo(...)` call, mirroring
    // Schedule 1's own single-call precedent above. `scheduleTwoTaxes`
    // stays in `unmodeledKindRefusals`, so both totals are `0n` for every
    // profile this engine can otherwise compute.
    const scheduleTwoResult = scheduleTwo(profile)
    const line17 = {
        value: scheduleTwoResult.line3.value,
        sources: scheduleTwoResult.line3.sources,
        rule: '1040 line 17',
    }  // Schedule 2 Part I total (line3)
    const line18 = totalLine('1040 line 18')([line16, line17])

    // 19 and 28 — Schedule 8812 (`fjs/form8812`, Plan 13-09/13-10, TAX-12):
    // Part I's CTC/ODC (line 14) feeds line 19, Part II-A's ACTC (line 27)
    // feeds line 28, both from ONE function execution so line 28 is never
    // independently stale on Part I's own state (13-CONTEXT.md Decision
    // 4.3). Read UNCONDITIONALLY, exactly like every other Wave 1-3 wiring —
    // a MODELED line reports what the facts say; `declaredKinds` gates the
    // WHOLE-RETURN refusal for `childTaxCreditOrOtherDependents`/
    // `additionalChildTaxCredit` (`fjs/return/scope`), never these two
    // individual lines. For a profile that declares either kind while it is
    // still unmodeled, this wiring is UNREACHABLE: `form1040Report`'s own
    // `classifyScope` call refuses the whole return before this function
    // ever runs.
    //
    // `dependents` is read off the profile and normalized from `option(true)`
    // booleans to definite ones — the same `=== true` normalization
    // `fjs/schedule/b` performs on `hadForeignFinancialAccount`, and exactly
    // what `fjs/form8812`'s own docstring expects its caller to do before it
    // ever sees the array.
    const form8812Outcome = form8812(taxParamSet)({
        status,
        agiCents: income.line11b.value,
        dependents: (profile.value.dependents ?? []).map(d => ({
            relationship: d.relationship,
            ssnValidForEmployment: d.ssnValidForEmployment === true,
            ageAtYearEnd: d.ageAtYearEnd,
            livedWithTaxpayer: d.livedWithTaxpayer === true,
        })),
        line18Cents: line18.value,
        earnedIncomeCents: profile.value.earnedIncome === undefined
            ? 0n
            : centsFromString(profile.value.earnedIncome),
        nontaxableCombatPayCents: 0n,
    })
    // Part II-B's refusal (3+ qualifying children or Puerto Rico residents)
    // is the THIRD document-data-sufficiency early-return guard in this file
    // — Schedule D's absent-basis guard (above, in `form1040IncomeLines`) and
    // Wave 1's `iraDeductionDeclared` guard are the first two — threaded
    // exactly the same way: `unmodeled: []`, since it names no
    // `fjs/return/scope` kind.
    if (form8812Outcome.kind === 'error') {
        return { kind: 'error', message: form8812Outcome.message, unmodeled: [] }
    }
    const line19 = {
        value: form8812Outcome.line14,
        sources: unionSources([income.line11b]),
        rule: '1040 line 19',
    }
    // 20/31 — Schedule 3 (`fjs/schedule/3`, Plan 13-11/13-12, TAX-14):
    // Part I's total nonrefundable credits (line8) feeds 1040 line 20,
    // Part II's total other payments/refundable credits (line15) feeds
    // 1040 line 31 — ONE `scheduleThree(...)` call, mirroring Schedule 1
    // and Schedule 2's own single-call precedent above.
    // `scheduleThreeNonrefundableCredits`/`scheduleThreeRefundableCredits`
    // stay in `unmodeledKindRefusals`, so both totals are `0n` for every
    // profile this engine can otherwise compute.
    const scheduleThreeResult = scheduleThree(profile)
    const line20 = {
        value: scheduleThreeResult.line8.value,
        sources: scheduleThreeResult.line8.sources,
        rule: '1040 line 20',
    }  // Schedule 3 Part I total (line8)
    const line21 = totalLine('1040 line 21')([line19, line20])
    const line22 = line22TaxLessNonrefundableCredits(line18)(line21)
    // 23 — Schedule 2 Part II's own total (line21), from the SAME
    // `scheduleTwoResult` computed at line 17, above — never a second,
    // independently stale `scheduleTwo(...)` call.
    const line23 = {
        value: scheduleTwoResult.line21.value,
        sources: scheduleTwoResult.line21.sources,
        rule: '1040 line 23',
    }  // other taxes, Schedule 2 Part II total (line21)
    const line24 = totalLine('1040 line 24')([line22, line23])

    // 25a/25b — federal income tax withheld, read off the forms themselves:
    // W-2 box 2 for 25a; 1099-INT, 1099-R, 1099-DIV and 1099-B box 4 for
    // 25b — `federalTaxWithheldOnOther1099`'s own remedy string names all
    // three of the latter document types (`fjs/return/scope`), so all three
    // join this line in this task rather than being deferred to a later
    // wave. 25c is every other form, which no dialect models. 25d is the
    // total the printed form adds.
    const line25a = fromDocuments('1040 line 25a')(
        sumBoxOverDocuments(w2s)('box2FederalIncomeTaxWithheld')(
            w2 => w2.box2FederalIncomeTaxWithheld))
    const line25b = fromDocuments('1040 line 25b')(
        addBoxSums(
            addBoxSums(
                sumBoxOverDocuments(interestForms)('box4FederalIncomeTaxWithheld')(
                    form => form.box4FederalIncomeTaxWithheld))(
                sumBoxOverDocuments(retirementForms)('box4FederalIncomeTaxWithheld')(
                    form => form.box4FederalIncomeTaxWithheld)))(
            addBoxSums(
                sumBoxOverDocuments(dividendForms)('box4FederalIncomeTaxWithheld')(
                    form => form.box4FederalIncomeTaxWithheld))(
                sumBoxOverDocuments(brokerageForms)('box4FederalIncomeTaxWithheld')(
                    form => form.box4FederalIncomeTaxWithheld))))
    const line25c = declaredZero('1040 line 25c')
    const line25d = totalLine('1040 line 25d')([line25a, line25b, line25c])

    // 26 — estimated tax payments, declared on the profile rather than read off
    // a form: there is no IRS document for "I sent four cheques". The profile's
    // own cross-field check refuses the amount unless `estimatedTaxPayments` is
    // declared, so an amount here can never be an input the scope guard did not
    // see.
    const line26 = fromDocuments('1040 line 26')(
        profileMoneyBox(profile)('line26EstimatedTaxPayments'))
    const line27a = declaredZero('1040 line 27a') // earned income credit
    // 28 — additional child tax credit: Schedule 8812 Part II-A's line 27,
    // computed above alongside line 19 from the SAME `form8812Outcome`, per
    // Decision 4.3 — never independently re-derived here.
    const line28 = {
        value: form8812Outcome.line27,
        sources: unionSources([income.line11b, line18]),
        rule: '1040 line 28',
    }
    const line29 = declaredZero('1040 line 29')   // American opportunity credit
    const line30 = declaredZero('1040 line 30')   // refundable adoption credit
    // 31 — Schedule 3 Part II's own total (line15), from the SAME
    // `scheduleThreeResult` computed at line 20, above — never a second,
    // independently stale `scheduleThree(...)` call.
    const line31 = {
        value: scheduleThreeResult.line15.value,
        sources: scheduleThreeResult.line15.sources,
        rule: '1040 line 31',
    }   // Schedule 3 Part II total (line15)
    const line32 = totalLine('1040 line 32')([line27a, line28, line29, line30, line31])
    const line33 = totalLine('1040 line 33')([line25d, line26, line32])

    // 34 and 37 — the two directions of one comparison, and they are never both
    // non-zero: when payments equal the tax exactly, both are `0n`. Written as
    // the printed form writes them, one per line, rather than as one signed
    // difference — the form has an overpayment line and an amount-owed line,
    // and a report that put a negative number on either would not be a 1040.
    const line34 = {
        value: line33.value > line24.value ? line33.value - line24.value : 0n,
        sources: unionSources([line33, line24]),
        rule: '1040 line 34',
    }
    // 35a and 36 — how the taxpayer wants an overpayment split: refunded now,
    // or applied to next year's estimated tax. Both are declarations, so both
    // come off the profile.
    const line35a = fromDocuments('1040 line 35a')(
        profileMoneyBox(profile)('line35aRefundRequested'))
    const line36 = fromDocuments('1040 line 36')(
        profileMoneyBox(profile)('line36AppliedToNextYear'))
    const line37 = {
        value: line24.value > line33.value ? line24.value - line33.value : 0n,
        sources: unionSources([line24, line33]),
        rule: '1040 line 37',
    }

    return {
        kind: 'ok',
        line16Method: line16Outcome.method,
        tax: {
            line16, line17, line18, line19, line20, line21, line22, line23, line24,
            line25a, line25b, line25c, line25d,
            line26,
            line27a, line28, line29, line30, line31, line32, line33, line34,
            line35a, line36,
            line37,
        },
    }
}

/**
 * The whole return as one flat list, in PRINTED ORDER — the shape a report
 * renders and the shape the whole-dollar election is applied over.
 *
 * Enumerated rather than produced by walking the two records, because printed
 * order is the property being asserted and an object's key order is not a
 * thing worth resting a tax form on. A line present in a record but missing
 * here is caught by {@link expectedWholeReportLineCount}.
 * @type {(income: Form1040IncomeLines) => (tax: Form1040TaxAndPaymentLines) => readonly ReportLine[]}
 */
const orderedLines = income => tax => [
    income.line1a, income.line1b, income.line1c, income.line1d, income.line1e,
    income.line1f, income.line1g, income.line1h, income.line1i, income.line1z,
    income.line2a, income.line2b,
    income.line3a, income.line3b,
    income.line4a, income.line4b,
    income.line5a, income.line5b,
    income.line6a, income.line6b,
    income.line7a,
    income.line8,
    income.line9,
    income.line10,
    income.line11a, income.line11b,
    income.line12e,
    income.line13a, income.line13b,
    income.line14,
    income.line15,
    tax.line16, tax.line17, tax.line18, tax.line19, tax.line20, tax.line21,
    tax.line22, tax.line23, tax.line24,
    tax.line25a, tax.line25b, tax.line25c, tax.line25d,
    tax.line26,
    tax.line27a, tax.line28, tax.line29, tax.line30, tax.line31,
    tax.line32, tax.line33, tax.line34,
    tax.line35a, tax.line36,
    tax.line37,
]

/**
 * Lines 1a through 37 for a return **already known to be in scope** — no scope
 * guard here. `form1040Report` is the entry point that runs the guard first;
 * this is the computation it guards, kept separate so the guard's ordering is
 * visible at one call site rather than buried inside the arithmetic.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => Form1040Outcome}
 */
const computeForm1040 = taxParamSet => inputs => {
    const income = form1040IncomeLines(taxParamSet)(inputs)
    // The new, earlier error arm (Schedule D's absent-basis/undecided-category
    // refusal) comes back out as the WHOLE report's outcome, exactly like
    // `line16Outcome`'s own error arm does one function below — checked and
    // returned BEFORE `form1040TaxAndPaymentLines` is ever called, so no later
    // line is built for a return this engine could not finish computing.
    if (income.kind === 'error') {
        return income
    }
    const rest = form1040TaxAndPaymentLines(taxParamSet)(inputs)(income)
    if (rest.kind === 'error') {
        return rest
    }
    return {
        kind: 'ok',
        lines: orderedLines(income)(rest.tax),
        line16Method: rest.line16Method,
    }
}

// ── The whole return ─────────────────────────────────────────────────────────

/**
 * Recovers the profile's `declaredKinds` — stored as plain `string`s, because
 * a JSON blob's array field is an array of strings (`array(string)`) — as the
 * {@link Kind} union the scope guard is written against.
 *
 * **This is a narrowing, not a second validation rule**, and it is the same
 * device {@link storedFilingStatusNamed} uses one field over, for the same
 * reason: what flows onward is the MEMBER OF THE FROZEN VOCABULARY that
 * matched, not the string off the blob. The RULE that a declared kind must be
 * in the vocabulary lives in `fjs/return/profile`'s `checkReferences` check 4,
 * and a profile reaching this module has already passed it, so the `assert`
 * below is unreachable for a validated profile.
 *
 * **Why the narrowing lives here rather than in the guard.** The obvious
 * alternative — widen the guard to take `readonly string[]` — was considered
 * and rejected deliberately when that module shipped, and the reason is the
 * whole point of TAX-16: a typo'd kind would then simply fail to match
 * anything the engine models, be classified as "not unmodeled", and produce a
 * degenerate refusal — or worse, no refusal at all — instead of a loud one.
 * The frozen vocabulary is what makes an unmodeled input LOUD, and a widened
 * parameter would hand that guarantee back. AGENTS.md also bans a cast and a
 * `!` over the result, so `assert` is the only compliant path.
 * @type {(profile: Stored<ReturnProfile>) => readonly Kind[]}
 */
const declaredKindsOf = profile => {
    const declared = profile.value.declaredKinds.flatMap(name => {
        const kind = kindVocabulary.find(candidate => candidate === name)
        return kind === undefined ? [] : [kind]
    })
    assert(
        declared.length === profile.value.declaredKinds.length,
        [
            'the return profile declares a kind outside the frozen vocabulary',
            profile.value.declaredKinds,
        ],
    )
    return declared
}

/**
 * **The whole-return entry point.** Form 1040 lines 1a through 37 for a return
 * inside the declared scope, and a refusal NAMING what is unmodeled for one
 * that is not.
 *
 * ## 10-CONTEXT.md Decision 2, which governs the shape of everything here
 *
 * An unmodeled declared input makes the ENTIRE report an error result naming
 * what is unmodeled. **A partial 1040 is never returned**, so there is no way
 * to mistake one for a complete return. The rejected alternative — a per-line
 * refusal inside a returned report — is more informative for debugging and
 * ships a document that LOOKS like a 1040 while being incomplete, which is the
 * exact failure mode TAX-16 exists to prevent.
 *
 * The error arm of {@link Form1040Outcome} therefore has **no `lines` field at
 * all**, and that is a type-level property rather than a convention: adding
 * one back does not compile. A caller cannot accidentally render a partial
 * 1040 because there is nothing to render — strictly stronger than returning
 * an empty array, which a renderer would happily draw as a form of zeros.
 *
 * ## The order of the body IS the rule
 *
 * 1. Classify the DECLARED kinds, **before any line is computed**, and return
 *    the refusal immediately. Not one number is figured for a return this
 *    engine cannot finish. Nothing here builds a refusal of its own: the one
 *    place a scope refusal is constructed is `fjs/return/scope`, for the
 *    reason recorded there — the zero-read kill condition once existed in two
 *    places, every proof bound to the copy that did not ship, and 258 tests
 *    were green over a rule with no coverage at all.
 * 2. Compute lines 1a-37. Line 16's own refusing arm comes back out as the
 *    whole report's outcome by the same rule.
 * 3. Apply the taxpayer's whole-dollar election ONCE, over the whole line
 *    list, at the end. The election is all-or-nothing for the entire return
 *    (i1040gi p23, "If you do round to whole dollars, you must round all
 *    amounts"), and applying it here — to the exact cents values, once — is
 *    what makes the report `round(sum)` rather than `sum(round)`. Rounding
 *    twice is not rounding once, and the difference is $4 on ten $1.39
 *    documents.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => Form1040Outcome}
 */
export const form1040Report = taxParamSet => inputs => {
    const { profile } = inputs
    const scope = classifyScope(declaredKindsOf(profile))
    if (scope.kind === 'error') {
        return { kind: 'error', message: scope.message, unmodeled: scope.unmodeled }
    }
    const computed = computeForm1040(taxParamSet)(inputs)
    if (computed.kind === 'error') {
        return computed
    }
    return {
        kind: 'ok',
        lines: applyWholeDollarElection(profile.value.wholeDollarElection === true)(computed.lines),
        line16Method: computed.line16Method,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope —
 * `noUncheckedIndexedAccess` makes the open year-keyed lookup yield
 * `TaxParamSet | undefined`, and a cast or `!` is banned, so `assert` is the
 * only compliant narrowing path (`fjs/tax/deduction` does the same).
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * Independently HAND-TYPED: the number of printed lines
 * {@link Form1040IncomeLines} carries today — 1a-1i and 1z (10), 2a/2b (2),
 * 3a/3b, 4a/4b, 5a/5b, 6a/6b (8), 7a, 8, 9, 10 (4), 11a/11b (2), 12e, 13a/13b,
 * 14, 15 (5) = 31.
 *
 * Deliberately NOT `Object.keys(...).length` of the produced record. The
 * fourth shipped instance of this project's recurring defect (AGENTS.md) was a
 * proof whose iteration set came from the code under test, so dropping an
 * entry removed it from the proof's own loop in the same instant.
 * {@link everyLineCitesAtLeastOneDocument} iterates the produced record, which
 * is exactly that shape — so it is paired with this count, the
 * `expectedMoneyBoxFieldCount` idiom.
 * @type {number}
 */
const expectedIncomeLineCount = 31

/**
 * The printed-line FIELD NAMES {@link Form1040IncomeLines} carries, in the
 * same order and count as {@link expectedIncomeLineCount} — hand-typed rather
 * than `Object.keys(...)`, for the same reason that count is hand-typed.
 *
 * Needed because Plan 12.1-04 widened `Form1040IncomeLines`'s `ok` arm with
 * FIVE bookkeeping fields that are dispatcher INPUTS, never printed
 * `ReportLine`s (`kind`, `filingScheduleD`, `scheduleD15Cents`,
 * `scheduleD16Cents`, `scheduleD18Cents`, `scheduleD19Cents`) — a bare
 * `Object.entries(...)` walk would now include them and crash on their
 * missing `.sources`/`.rule` shape. Naming exactly the printed-line keys is
 * both the fix and a second independent check that nothing besides these 31
 * is a printed line.
 * @type {readonly Exclude<keyof Form1040IncomeLines, 'kind' | 'filingScheduleD' | 'scheduleD15Cents' | 'scheduleD16Cents' | 'scheduleD18Cents' | 'scheduleD19Cents'>[]}
 */
const incomeLineFieldNames = /** @type {const} */ ([
    'line1a', 'line1b', 'line1c', 'line1d', 'line1e', 'line1f', 'line1g', 'line1h', 'line1i', 'line1z',
    'line2a', 'line2b',
    'line3a', 'line3b',
    'line4a', 'line4b',
    'line5a', 'line5b',
    'line6a', 'line6b',
    'line7a',
    'line8',
    'line9',
    'line10',
    'line11a', 'line11b',
    'line12e',
    'line13a', 'line13b',
    'line14',
    'line15',
])

/**
 * Independently HAND-TYPED: the number of printed money lines the WHOLE report
 * emits, 1a through 37.
 *
 * Counted off the form face, in two groups so the arithmetic is checkable
 * without re-reading the code: lines 1a-15 are the 31 of
 * {@link expectedIncomeLineCount}, and lines 16-37 add 25 — 16, 17, 18, 19,
 * 20, 21, 22, 23, 24 (9), 25a, 25b, 25c, 25d (4), 26 (1), 27a, 28, 29, 30, 31
 * (5), 32, 33, 34 (3), 35a, 36 (2), 37 (1). `31 + 25 = 56`.
 *
 * Lines 12a-12d and 7b are NOT money lines — they are checkboxes, carried on
 * the return profile — and line 38 (the estimated tax penalty) is outside
 * "1a-37". Neither is counted.
 *
 * Written out rather than derived from `orderedLines(...).length`, for the
 * reason on {@link expectedIncomeLineCount}: a count read from the code under
 * test moves with it and can never fail.
 * @type {number}
 */
const expectedWholeReportLineCount = 56

/** The profile document every fixture below is built on: a single filer. */
const profileHash = 'sha256-profile-01'

/** @type {ReturnProfile} */
const singleProfile = {
    dialect: returnProfileDialect,
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: ['wages', 'taxableInterest'],
}

/**
 * The `declaredKinds` rendering {@link profileDeclaredZeroLine} emits for
 * {@link singleProfile} — hand-typed, never produced by calling
 * `JSON.stringify` here, so a change to how a declaration is quoted is a
 * change this proof notices.
 * @type {string}
 */
const singleProfileDeclaredKindsRendering = '["wages","taxableInterest"]'

/**
 * Wraps a profile value as a stored document. Test-only: builds INPUTS, never
 * an expected value.
 * @type {(value: ReturnProfile) => Stored<ReturnProfile>}
 */
const storedProfile = value => ({ documentHash: profileHash, value })

/**
 * A W-2 carrying one box-1 amount. Every identity field is fixed; only the
 * hash and the amount vary, so a leaf's failure localizes to the amount.
 * @type {(documentHash: string) => (box1WagesTipsOtherCompensation: string) => Stored<W2>}
 */
const w2Document = documentHash => box1WagesTipsOtherCompensation => ({
    documentHash,
    value: {
        dialect: w2Dialect,
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-W2',
        taxYear: 2025,
        formRevision: '2025',
        box1WagesTipsOtherCompensation,
    },
})

/**
 * A W-2 that also carries box 2 withholding, built ON TOP of
 * {@link w2Document} rather than beside it, so the two fixtures cannot drift
 * in their identity fields.
 * @type {(documentHash: string) => (box1WagesTipsOtherCompensation: string) => (box2FederalIncomeTaxWithheld: string) => Stored<W2>}
 */
const w2WithWithholding = documentHash => box1WagesTipsOtherCompensation =>
    box2FederalIncomeTaxWithheld => {
        const withoutWithholding = w2Document(documentHash)(box1WagesTipsOtherCompensation)
        return {
            ...withoutWithholding,
            value: { ...withoutWithholding.value, box2FederalIncomeTaxWithheld },
        }
    }

/**
 * The 1099-INT money boxes lines 2a, 2b and 25b read. A box the fixture OMITS
 * is absent in the DOC-11 sense — the point of the absent-box leaf.
 * @typedef {{
 *   readonly box1InterestIncome?: string,
 *   readonly box3UsSavingsBondsAndTreasuryInterest?: string,
 *   readonly box4FederalIncomeTaxWithheld?: string,
 *   readonly box8TaxExemptInterest?: string,
 * }} InterestBoxes
 */

/**
 * A 1099-INT carrying whichever of the three read boxes the caller names.
 * @type {(documentHash: string) => (boxes: InterestBoxes) => Stored<OneZeroNineNineInt>}
 */
const interestDocument = documentHash => boxes => ({
    documentHash,
    value: {
        dialect: oneZeroNineNineIntDialect,
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-INT',
        taxYear: 2025,
        formRevision: '2025',
        ...boxes,
    },
})

/** The `sourceArtifactHash` every 1099-DIV/1099-B test fixture below shares —
 * the same literal `fjs/form8949`/`fjs/schedule/d` use for theirs.
 * @type {string}
 */
const dividendAndBrokerageSourceArtifactHash
    = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/** The 1099-DIV boxes this file's fixtures read. The first three are Plan
 * 12.1-04's own; `box2bUnrecapSec1250Gain`/`box2dCollectibles28PercentGain`
 * were added closing 12.1-VERIFICATION.md's WARNING (the decorative-proof
 * fix) — a NON-ZERO Schedule D 18/19 fixture needs them.
 * `box4FederalIncomeTaxWithheld` is Plan 13-02's own addition — line 25b now
 * reads it, per `federalTaxWithheldOnOther1099`'s own remedy string.
 * @typedef {{
 *   readonly box1aTotalOrdinaryDividends?: string,
 *   readonly box1bQualifiedDividends?: string,
 *   readonly box2aTotalCapitalGainDistr?: string,
 *   readonly box2bUnrecapSec1250Gain?: string,
 *   readonly box2dCollectibles28PercentGain?: string,
 *   readonly box4FederalIncomeTaxWithheld?: string,
 * }} DividendBoxes
 */

/**
 * A 1099-DIV carrying whichever of the three read boxes the caller names.
 * @type {(documentHash: string) => (boxes: DividendBoxes) => Stored<OneZeroNineNineDiv>}
 */
const dividendDocument = documentHash => boxes => ({
    documentHash,
    value: {
        dialect: oneZeroNineNineDivDialect,
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-DIV',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: dividendAndBrokerageSourceArtifactHash,
        ...boxes,
    },
})

/**
 * A 1099-B carrying whichever boxes the caller names, mirroring
 * `fjs/schedule/d`'s own `brokerageForm` fixture shape.
 * @type {(documentHash: string) => (overrides: Partial<OneZeroNineNineB>) => Stored<OneZeroNineNineB>}
 */
const brokerageDocument = documentHash => overrides => ({
    documentHash,
    value: {
        dialect: oneZeroNineNineBDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-B',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: dividendAndBrokerageSourceArtifactHash,
        ...overrides,
    },
})

/**
 * The 1099-R boxes lines 4a/4b/5a/5b/25b read, plus the box 7b IRA/SEP/SIMPLE
 * checkbox that routes a document between the two pairs of lines
 * (13-RESEARCH.md Pitfall 4).
 * @typedef {{
 *   readonly box1GrossDistribution?: string,
 *   readonly box2aTaxableAmount?: string,
 *   readonly box4FederalIncomeTaxWithheld?: string,
 *   readonly box7bIraSepSimple?: true,
 * }} RetirementBoxes
 */

/**
 * A 1099-R carrying whichever of the read boxes the caller names.
 * @type {(documentHash: string) => (boxes: RetirementBoxes) => Stored<OneZeroNineNineR>}
 */
const retirementDocument = documentHash => boxes => ({
    documentHash,
    value: {
        dialect: oneZeroNineNineRDialect,
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-R',
        taxYear: 2025,
        formRevision: '2025',
        ...boxes,
    },
})

/**
 * An SSA-1099 carrying box 5 net benefits — the one box line 6a reads.
 * `payerTin` is always `''` — the dialect's own deliberate deviation
 * (`fjs/document/ssa1099`'s own docstring): SSA-1099 prints no payer TIN.
 * @type {(documentHash: string) => (box5NetBenefits: string) => Stored<Ssa1099>}
 */
const socialSecurityDocument = documentHash => box5NetBenefits => ({
    documentHash,
    value: {
        dialect: ssa1099Dialect,
        payerTin: '',
        recipientTin: '222-22-2222',
        accountNumber: 'CLAIM-0001',
        taxYear: 2025,
        formRevision: '2025',
        box5NetBenefits,
    },
})

/**
 * A `vnd.fjs.itemized_deductions` document carrying one entry per named
 * `(lineTag, amount)` pair — Plan 13-07's own end-to-end fixture builder,
 * mirroring {@link socialSecurityDocument}'s shape one dialect over.
 * @type {(documentHash: string) => (entries: readonly { readonly lineTag: string, readonly amount: string }[]) => Stored<ItemizedDeductions>}
 */
const itemizedDeductionsDocument = documentHash => entries => ({
    documentHash,
    value: {
        dialect: itemizedDeductionsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: entries.map(entry => ({ lineTag: entry.lineTag, provider: 'Some Provider', amount: entry.amount })),
    },
})

/**
 * Assembles the nine input lists into a {@link Form1040Inputs}. Widened from
 * three to five curried parameters by Plan 12.1-04 (`dividendForms`,
 * `brokerageForms`), from five to seven by Plan 13-02 (`retirementForms`,
 * `socialSecurityForms`), and from seven to nine by Plan 13-07
 * (`itemizedDeductionForms`, `medicalExpenseForms`) — `npx tsc --noEmit` is
 * what surfaced every call site below needing the two extra empty-array
 * arguments, per this plan's own instruction not to enumerate them from
 * memory.
 * @type {(profile: Stored<ReturnProfile>) => (w2s: readonly Stored<W2>[]) => (interestForms: readonly Stored<OneZeroNineNineInt>[]) => (dividendForms: readonly Stored<OneZeroNineNineDiv>[]) => (brokerageForms: readonly Stored<OneZeroNineNineB>[]) => (retirementForms: readonly Stored<OneZeroNineNineR>[]) => (socialSecurityForms: readonly Stored<Ssa1099>[]) => (itemizedDeductionForms: readonly Stored<ItemizedDeductions>[]) => (medicalExpenseForms: readonly Stored<MedicalExpenses>[]) => Form1040Inputs}
 */
const inputsOf = profile => w2s => interestForms => dividendForms => brokerageForms =>
    retirementForms => socialSecurityForms => itemizedDeductionForms => medicalExpenseForms =>
        ({
            profile, w2s, interestForms, dividendForms, brokerageForms,
            retirementForms, socialSecurityForms,
            itemizedDeductionForms, medicalExpenseForms,
        })

/**
 * Narrows a {@link Form1040IncomeLines}-or-{@link Form1040Error} result to the
 * `ok` arm, for the many proof leaves in this file that call
 * `form1040IncomeLines` DIRECTLY (rather than through the full
 * `form1040Report` entry point) and then read `.lineN` fields straight off
 * the result. Every fixture reaching this helper declares no unmodeled kind
 * and no Schedule-D absent-basis condition, so the assert is a real
 * narrowing that documents an invariant of the fixture, not false
 * confidence — mirrors `fjs/schedule/d`'s own `expectOk` idiom.
 * @type {(outcome: Form1040IncomeLines | Form1040Error) => Form1040IncomeLines}
 */
const expectIncomeOk = outcome => {
    assert(outcome.kind === 'ok', ['expected the income lines to compute', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected ok', outcome]
    }
    return outcome
}

/**
 * The same narrowing idiom as {@link expectIncomeOk}, for the handful of
 * proof leaves below that call `scheduleA(...)` DIRECTLY as an independent
 * cross-check of `form1040Report`'s own wiring (CR-01/WR-04 widened
 * `scheduleA`'s return type to `ScheduleAOutcome`).
 * @type {(outcome: ScheduleAOutcome) => Extract<ScheduleAOutcome, { readonly kind: 'ok' }>}
 */
const expectScheduleAOk = outcome => {
    assert(outcome.kind === 'ok', ['expected scheduleA(...) to compute, not refuse', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected ok', outcome]
    }
    return outcome
}

/**
 * A qualifying surviving spouse with BOTH taxpayer age/blindness boxes
 * checked — two boxes, which is the maximum the printed chart prints for this
 * status (10-CONTEXT.md Decision 6). No spouse box: `fjs/return/profile`
 * refuses those for QSS at ingest, which is the property
 * `qualifyingSurvivingSpouseCanNeverExceedTwoBoxes` pins from both sides.
 * @type {ReturnProfile}
 */
const qualifyingSurvivingSpouseTwoBoxProfile = {
    ...singleProfile,
    filingStatus: 'qualifyingSurvivingSpouse',
    taxpayerBornBeforeJan2_1961: true,
    taxpayerIsBlind: true,
}

/**
 * A married-filing-jointly filer with all FOUR line-12d boxes checked — the
 * only shape in which dropping one box from the tally is visible.
 * @type {ReturnProfile}
 */
const marriedFilingJointlyFourBoxProfile = {
    ...singleProfile,
    filingStatus: 'marriedFilingJointly',
    taxpayerBornBeforeJan2_1961: true,
    taxpayerIsBlind: true,
    spouseBornBeforeJan2_1961: true,
    spouseIsBlind: true,
}

/**
 * A filer someone else can claim as a dependent, with the earned income the
 * Standard Deduction Worksheet for Dependents reads. Exception 1 REPLACES the
 * chart, so these two profiles are the only ones whose line 12e is not a chart
 * row.
 * @type {(earnedIncome: string) => ReturnProfile}
 */
const dependentProfile = earnedIncome => ({
    ...singleProfile,
    claimedAsDependent: true,
    earnedIncome,
})

/**
 * A married-filing-separately filer with all FOUR line-12d boxes checked and
 * the i1040gi p33 footnote condition declared — without which
 * `fjs/return/profile` check 5b refuses the two spouse boxes outright, so the
 * profile could not carry four boxes at all.
 *
 * The base for the two exception fixtures below, and it is FOUR boxes rather
 * than none on purpose: this is the largest amount the printed MFS column
 * reaches ($22,150), so an exception that fails to fire is wrong by the widest
 * margin the status can produce — and a leaf built on a no-box profile could
 * not tell "the exception fired" apart from "an increment went missing".
 * @type {ReturnProfile}
 */
const marriedFilingSeparatelyFourBoxProfile = {
    ...singleProfile,
    filingStatus: 'marriedFilingSeparately',
    taxpayerBornBeforeJan2_1961: true,
    taxpayerIsBlind: true,
    spouseBornBeforeJan2_1961: true,
    spouseIsBlind: true,
    spouseHadNoIncomeIsNotFilingAndIsNotADependent: true,
}

/**
 * Exception 2 (line 12b) — married filing separately and the spouse itemizes.
 * @type {ReturnProfile}
 */
const spouseItemizesProfile = {
    ...marriedFilingSeparatelyFourBoxProfile,
    spouseItemizes: true,
}

/**
 * Exception 3 (line 12c) — a dual-status alien. Carried on the SAME four-box
 * base, so the two exception leaves differ in exactly one box and neither can
 * pass on the other's account.
 * @type {ReturnProfile}
 */
const dualStatusAlienProfile = {
    ...marriedFilingSeparatelyFourBoxProfile,
    dualStatusAlien: true,
}

/**
 * Ten REAL stored 1099-INT documents with ten DISTINCT hashes, each carrying
 * the IRS's own printed rounding example in box 1: `'1.39'` (i1040gi p23, "For
 * example, $1.39 becomes $1").
 *
 * Written out ten times rather than generated from a count, so the fixture is
 * ten separately-addressable documents a reader can check against the
 * assertion of ten sources — and so no length is ever derived from the same
 * expression the assertion reads.
 * @type {readonly Stored<OneZeroNineNineInt>[]}
 */
const tenInterestDocumentsAtOneThirtyNine = [
    interestDocument('sha256-int-01')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-02')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-03')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-04')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-05')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-06')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-07')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-08')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-09')({ box1InterestIncome: '1.39' }),
    interestDocument('sha256-int-10')({ box1InterestIncome: '1.39' }),
]

/**
 * Runs the real line assembly over one profile and no documents — the shape
 * every line-12e leaf needs, since 12e reads the profile alone.
 * @type {(value: ReturnProfile) => Form1040IncomeLines}
 */
const linesForProfile = value => expectIncomeOk(form1040IncomeLines(taxParams2025)(
    inputsOf(storedProfile(value))([])([])([])([])([])([])([])([])))

/**
 * A married-filing-jointly filer with no checked boxes, declaring the same two
 * kinds as {@link singleProfile}. The status the IRS's own printed Tax Table
 * Example uses ("Mr. and Mrs. Brown are filing a joint return").
 * @type {ReturnProfile}
 */
const marriedFilingJointlyProfile = {
    ...singleProfile,
    filingStatus: 'marriedFilingJointly',
}

/**
 * The same joint filer, additionally declaring the two withholding kinds this
 * engine models. Withholding read off a form the taxpayer did not declare
 * would be an input the scope guard never saw, so the declaration is part of
 * the fixture rather than an afterthought.
 * @type {ReturnProfile}
 */
const withholdingProfile = {
    ...marriedFilingJointlyProfile,
    declaredKinds: [
        'wages',
        'taxableInterest',
        'federalTaxWithheldOnW2',
        'federalTaxWithheldOn1099Int',
    ],
}

/**
 * Runs the WHOLE line assembly — 1a-15 and then 16-37 — and hands back both
 * records plus the selected line-16 method, asserting that the return
 * computed.
 *
 * Test-only, and it builds no expected value: every number a leaf asserts is
 * hand-typed at the assertion.
 * @type {(inputs: Form1040Inputs) => { readonly income: Form1040IncomeLines, readonly tax: Form1040TaxAndPaymentLines, readonly line16Method: Line16Method }}
 */
const computedLines = inputs => {
    const income = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputs))
    const rest = form1040TaxAndPaymentLines(taxParams2025)(inputs)(income)
    assert(rest.kind === 'ok', ['expected this return to compute lines 16-37', rest])
    return { income, tax: rest.tax, line16Method: rest.line16Method }
}

/**
 * **The DECLARED profile this whole phase was written for**: 65+, married
 * filing jointly, two dependents — and therefore declaring two kinds this
 * engine does not model, Schedule 1-A's enhanced deduction for seniors (line
 * 13b, TAX-09) and the child tax credit (line 19, Schedule 8812, TAX-12).
 *
 * ROADMAP.md already states the consequence: "a 65+ TY2025 return omitting
 * Schedule 1-A is structurally wrong, not merely incomplete." Phase 10's
 * acceptance is that this profile produces a LOUD, NAMED refusal — not that it
 * computes. Both kinds must be named: a guard reporting only the first would
 * still ship a return missing a line.
 * @type {ReturnProfile}
 */
const sixtyFivePlusProfile = {
    ...marriedFilingJointlyProfile,
    taxpayerBornBeforeJan2_1961: true,
    spouseBornBeforeJan2_1961: true,
    dependentCount: 2,
    declaredKinds: [
        'wages',
        'taxableInterest',
        'seniorAndOtherScheduleOneADeductions',
        'childTaxCreditOrOtherDependents',
    ],
}

/**
 * THE CONTROL profile: {@link sixtyFivePlusProfile} with the two unmodeled
 * kinds removed and **everything else identical** — both age boxes still
 * checked, both dependents still declared. Same taxpayer, a narrower
 * declaration, and it computes lines 1a-37 end to end.
 * @type {ReturnProfile}
 */
const sixtyFivePlusProfileWithinScope = {
    ...sixtyFivePlusProfile,
    declaredKinds: ['wages', 'taxableInterest'],
}

/**
 * Finds the one report line implementing a printed rule, by the PREFIX of its
 * `rule` string — line 16's rule also names the method that produced it, so an
 * exact match would bind this helper to a particular branch.
 * @type {(lines: readonly ReportLine[]) => (rulePrefix: string) => ReportLine}
 */
const lineRuled = lines => rulePrefix => assertNotNullish(
    lines.find(line => line.rule.startsWith(rulePrefix)),
    `expected the report to carry ${rulePrefix}`)

/**
 * A test-only {@link ReportLine} for the line-22 floor leaves — the one rule
 * in this module a whole report cannot reach (see
 * {@link line22TaxLessNonrefundableCredits}). Builds INPUTS only.
 * @type {(value: bigint) => (rule: string) => ReportLine}
 */
const flooringTestLine = value => rule => ({
    value,
    sources: [{ documentHash: profileHash, boxPath: 'declaredKinds', value: '[]' }],
    rule,
})

/**
 * A test-only {@link Source}, so the {@link unionSources} leaves can be read
 * as "which pairs collide" rather than as six object literals.
 * @type {(documentHash: string) => (boxPath: string) => Source}
 */
const source = documentHash => boxPath => ({ documentHash, boxPath, value: '1.00' })

/**
 * A test-only one-source {@link ReportLine}. Builds INPUTS only.
 * @type {(sources: readonly [Source, ...(readonly Source[])]) => ReportLine}
 */
const unionTestLine = sources => ({ value: 0n, sources, rule: '1040 line 9' })

/**
 * A married-filing-jointly filer declaring `capitalGainsOrLosses` — still
 * refused by `fjs/return/scope` at the end of Plan 12.1-04's Task 1 (the six
 * kinds have not moved yet), so every leaf below reaching this profile
 * through `form1040Report` is EXPECTED to refuse, and the third/fourth
 * fixtures instead call `form1040IncomeLines` directly, mirroring this
 * file's own `linesForProfile`-style pattern.
 * @type {ReturnProfile}
 */
const declaringCapitalGainsOrLossesProfile = {
    ...singleProfile,
    declaredKinds: ['wages', 'taxableInterest', 'capitalGainsOrLosses'],
}

export const proof = {
    unionSources: {
        // The same box of the same document, cited by two different lines, is
        // ONE citation — and the first-seen position is the one kept.
        deduplicatesTheSamePairAndPreservesFirstSeenOrder: () => {
            const a = source('sha256-doc1')('box1InterestIncome')
            const b = source('sha256-doc2')('box1InterestIncome')
            const c = source('sha256-doc3')('box1InterestIncome')
            const united = unionSources([unionTestLine([a, b]), unionTestLine([b, c])])
            assertEq(united.length, 3)
            const [first, second, third] = united
            assertEq(first.documentHash, 'sha256-doc1')
            assertEq(second?.documentHash, 'sha256-doc2')
            assertEq(third?.documentHash, 'sha256-doc3')
        },
        // Two boxes of ONE document are two citations: the key is the pair,
        // not the hash. A hash-only key would silently drop box 3 from line
        // 2b's provenance while leaving its value correct.
        twoBoxesOfOneDocumentAreTwoCitations: () => {
            const united = unionSources([unionTestLine([
                source('sha256-doc1')('box1InterestIncome'),
                source('sha256-doc1')('box3UsSavingsBondsAndTreasuryInterest'),
            ])])
            assertEq(united.length, 2)
        },
        // One box of TWO documents is likewise two citations: the key is the
        // pair, not the box path.
        oneBoxOfTwoDocumentsAreTwoCitations: () => {
            const united = unionSources([unionTestLine([
                source('sha256-doc1')('box1InterestIncome'),
                source('sha256-doc2')('box1InterestIncome'),
            ])])
            assertEq(united.length, 2)
        },
        // PROV-01 survives the union: the result is still a non-empty tuple,
        // whatever collapsed inside it.
        completelyOverlappingSourcesStillLeaveANonEmptyTuple: () => {
            const only = source('sha256-doc1')('box1InterestIncome')
            const united = unionSources([unionTestLine([only]), unionTestLine([only])])
            assertEq(united.length, 1)
            assert(united.length > 0, 'a union must still carry at least one citation')
        },
    },
    line1a: {
        // $50,000 + $25,000 = $75,000, cited to both W-2s.
        twoWTwosSumToSeventyFiveThousandCitingBoth: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
                w2Document('sha256-w2-02')('25000.00'),
            ])([])([])([])([])([])([])([])))
            assertEq(lines.line1a.value, 7500000n)
            assertEq(lines.line1a.sources.length, 2)
            const [first, second] = lines.line1a.sources
            assertEq(first.documentHash, 'sha256-w2-01')
            assertEq(first.boxPath, 'box1WagesTipsOtherCompensation')
            // The raw stored string, quoted exactly — never re-formatted.
            assertEq(first.value, '50000.00')
            assertEq(second?.documentHash, 'sha256-w2-02')
            assertEq(lines.line1a.rule, '1040 line 1a')
        },
        // No W-2 at all: zero, citing the DECLARATION that makes it zero.
        // This is the leaf that fails if a zero line stops citing anything.
        noWTwoIsZeroCitingTheProfilesDeclaredKindsBox: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])))
            assertEq(lines.line1a.value, 0n)
            assertEq(lines.line1a.sources.length, 1)
            const [only] = lines.line1a.sources
            assertEq(only.documentHash, profileHash)
            assertEq(only.boxPath, 'declaredKinds')
            assertEq(only.value, singleProfileDeclaredKindsRendering)
        },
    },
    line2b: {
        // Box 1 $100.00 + box 3 $25.00 on ONE form = $125.00, two citations
        // from the same document at different box paths.
        boxOneAndBoxThreeOfOneFormAreTwoCitations: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({
                        box1InterestIncome: '100.00',
                        box3UsSavingsBondsAndTreasuryInterest: '25.00',
                    }),
                ])([])([])([])([])([])([])))
            assertEq(lines.line2b.value, 12500n)
            assertEq(lines.line2b.sources.length, 2)
            const [first, second] = lines.line2b.sources
            assertEq(first.boxPath, 'box1InterestIncome')
            assertEq(second?.boxPath, 'box3UsSavingsBondsAndTreasuryInterest')
            assertEq(second?.documentHash, 'sha256-int-01')
        },
        // DOC-11 at the report layer. Box 3 absent contributes NOTHING and
        // cites nothing. The VALUE cannot see the difference — `'0.00'` sums
        // to the same $100.00 — so the source COUNT is the only observer, and
        // that is exactly what this asserts.
        absentBoxIsSkippedNeverDefaultedToZero: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({ box1InterestIncome: '100.00' }),
                ])([])([])([])([])([])([])))
            assertEq(lines.line2b.value, 10000n)
            assertEq(lines.line2b.sources.length, 1)
            const [only] = lines.line2b.sources
            assertEq(only.boxPath, 'box1InterestIncome')
        },
        // The control for the box-8 mapping: tax-exempt interest is line 2a,
        // and it does not leak into 2b.
        taxExemptInterestIsLineTwoANotTwoB: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({
                        box1InterestIncome: '100.00',
                        box8TaxExemptInterest: '7.00',
                    }),
                ])([])([])([])([])([])([])))
            assertEq(lines.line2a.value, 700n)
            assertEq(lines.line2b.value, 10000n)
        },
    },
    line9: {
        // $75,000 of wages plus $125.00 of interest = $75,125.00, and the
        // sources are the union of all eight summands: two W-2 boxes, two
        // 1099-INT boxes, and the profile's `declaredKinds` box — cited by
        // seven different zero lines and DEDUPLICATED to one.
        sumsTheEightSummandsAndUnionsTheirSourcesDeduplicated: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
                w2Document('sha256-w2-02')('25000.00'),
            ])([
                interestDocument('sha256-int-01')({
                    box1InterestIncome: '100.00',
                    box3UsSavingsBondsAndTreasuryInterest: '25.00',
                }),
            ])([])([])([])([])([])([])))
            assertEq(lines.line9.value, 7512500n)
            // Hand-typed: 2 W-2 box-1 citations + 2 1099-INT box citations +
            // 1 profile `declaredKinds` citation = 5.
            assertEq(lines.line9.sources.length, 5)
        },
    },
    line11: {
        // 11a = 9 - 10, and 11b restates it: same value, same provenance,
        // a different printed name. A recomputation could disagree with 9.
        elevenBRestatesElevenAWithTheSameSources: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
            ])([])([])([])([])([])([])([])))
            assertEq(lines.line11a.value, 5000000n)
            assertEq(lines.line11b.value, 5000000n)
            assertEq(lines.line11a.sources.length, lines.line11b.sources.length)
            assertEq(lines.line11a.rule, '1040 line 11a')
            assertEq(lines.line11b.rule, '1040 line 11b')
        },
    },
    line12e: {
        // The chart's plainest row, and the CONTROL for every leaf below it:
        // the same filer with nothing checked takes the full $15,750 and cites
        // exactly ONE box — its filing status. Every expected amount in this
        // group is hand-typed from the printed Standard Deduction Chart
        // (f1040s.pdf p4), never computed from a base plus increments.
        singleWithNoCheckedBoxesIsFifteenSevenFiftyCitingFilingStatusAlone: () => {
            const { line12e } = linesForProfile(singleProfile)
            assertEq(line12e.value, 1575000n)
            assertEq(line12e.sources.length, 1)
            const [only] = line12e.sources
            assertEq(only.documentHash, profileHash)
            assertEq(only.boxPath, 'filingStatus')
            assertEq(only.value, 'single')
            assertEq(line12e.rule, '1040 line 12e')
        },
        // $31,500 + two $1,600 increments = $34,700, citing the filing status
        // and BOTH checked boxes: one citation per box, so a reader can see
        // which two the increments came from.
        qualifyingSurvivingSpouseWithTwoBoxesIsThirtyFourSevenCitingThreeBoxes: () => {
            const { line12e } = linesForProfile(qualifyingSurvivingSpouseTwoBoxProfile)
            assertEq(line12e.value, 3470000n)
            assertEq(line12e.sources.length, 3)
            const [first, second, third] = line12e.sources
            assertEq(first.boxPath, 'filingStatus')
            assertEq(second?.boxPath, 'taxpayerBornBeforeJan2_1961')
            assertEq(second?.value, 'true')
            assertEq(third?.boxPath, 'taxpayerIsBlind')
        },
        // $31,500 + four $1,600 increments = $37,900. The only shape in which
        // a box silently dropped from the tally changes an amount.
        marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes: () => {
            const { line12e } = linesForProfile(marriedFilingJointlyFourBoxProfile)
            assertEq(line12e.value, 3790000n)
            assertEq(line12e.sources.length, 5)
            const [, , , , fifth] = line12e.sources
            assertEq(fifth?.boxPath, 'spouseIsBlind')
        },
        // Exception 1, reached THROUGH THE PROFILE rather than by calling
        // `standardDeductionCents` directly. `fjs/tax/deduction`'s own 35
        // leaves all call that function with a correct input record, so a
        // wiring bug here — passing a constant `false` for
        // `claimedAsDependent`, or losing `earnedIncome` — leaves every one of
        // them green while this line ships the $15,750 chart amount to a
        // dependent entitled to $1,350. These two leaves are the only thing
        // that can see it, which is why they go through the profile.
        //
        // $500 of earned income is below the worksheet's threshold, so line 2
        // is the flat $1,350 minimum. Hand-typed from i1040gi p35.
        dependentBelowTheEarnedIncomeThresholdIsThirteenFiftyThroughTheProfile: () => {
            const { line12e } = linesForProfile(dependentProfile('500.00'))
            assertEq(line12e.value, 135000n)
        },
        // $2,000 is above the threshold, so line 2 is earned income plus the
        // $450 add-on = $2,450.
        dependentAboveTheEarnedIncomeThresholdIsTwentyFourFiftyThroughTheProfile: () => {
            const { line12e } = linesForProfile(dependentProfile('2000.00'))
            assertEq(line12e.value, 245000n)
        },
        // Exceptions 2 and 3, reached THROUGH THE PROFILE for the same reason
        // the two dependent leaves above are — and they were the gap the
        // Phase 10 verification found: `fjs/tax/deduction`'s own
        // `spouseItemizesIsZeroEvenWithFourBoxesChecked` and
        // `dualStatusAlienIsZeroEvenWithTwoBoxesChecked` call
        // `standardDeductionCents` with a correct input record, so hardcoding
        // either flag to `false` AT THIS CALLER left all 33 of that module's
        // leaves green while this line handed a married-filing-separately
        // filer whose spouse itemizes the full four-box chart row. "Wired" and
        // "proven wired" are different claims and only the second counts.
        //
        // `0n` is hand-typed from i1040gi p34, which states it twice: the
        // standard deduction is zero "even if you were born before January 2,
        // 1961, or were blind". It is NOT the chart row minus anything.
        //
        // Their CONTROL is
        // `marriedFilingJointlyWithFourBoxesIsThirtySevenNineCitingFiveBoxes`
        // above — also four checked boxes through this same caller, and
        // non-zero — so a caller that hardcoded either flag to `true` (a gate
        // that refuses everything) reddens there rather than passing here.
        // Not restated as a fourth fixture: one rule, one place.
        spouseItemizesIsZeroEvenWithFourBoxesCheckedThroughTheProfile: () => {
            const { line12e } = linesForProfile(spouseItemizesProfile)
            assertEq(line12e.value, 0n)
        },
        dualStatusAlienIsZeroEvenWithFourBoxesCheckedThroughTheProfile: () => {
            const { line12e } = linesForProfile(dualStatusAlienProfile)
            assertEq(line12e.value, 0n)
        },
        // TWO gates at TWO layers, asserted from both sides. `fjs/tax/deduction`
        // refuses a box count above the status maximum; `fjs/return/profile`
        // refuses the spouse boxes for a QSS filer at INGEST. Because of the
        // second, the count this module can ever derive for a QSS profile is at
        // most two — so the first is a genuine second gate rather than the only
        // one. A control-and-refusal pair, and the refusal asserts WHAT was
        // refused, never merely that something was.
        qualifyingSurvivingSpouseCanNeverExceedTwoBoxes: () => {
            // The control: a VALID QSS profile, two boxes, the chart's own
            // two-box row.
            const { line12e } = linesForProfile(qualifyingSurvivingSpouseTwoBoxProfile)
            assertEq(line12e.sources.length, 3)
            assertEq(line12e.value, 3470000n)
            // The gate: the blob that would have produced a third box never
            // becomes a `ReturnProfile` at all.
            const [t, v] = validateReturnProfile({
                ...qualifyingSurvivingSpouseTwoBoxProfile,
                spouseIsBlind: true,
            })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(
                v.includes('qualifyingSurvivingSpouse'),
                ['expected the refusal to name the filing status', v],
            )
            assert(
                v.includes('spouse age or blindness box'),
                ['expected the refusal to name what was refused', v],
            )
        },
    },
    line14: {
        // 12e + 13a + 13b. 13a and 13b are both profile-declared zeros citing
        // the SAME `declaredKinds` box, so the union deduplicates them to one:
        // the filing-status box plus one declaration box = 2.
        sumsTwelveEAndThirteenAAndThirteenBDeduplicatingTheProfileCitation: () => {
            const { line14 } = linesForProfile(singleProfile)
            assertEq(line14.value, 1575000n)
            assertEq(line14.sources.length, 2)
            const [first, second] = line14.sources
            assertEq(first.boxPath, 'filingStatus')
            assertEq(second?.boxPath, 'declaredKinds')
        },
    },
    line15: {
        // $50,000 of wages less the $15,750 standard deduction = $34,250.
        taxableIncomeIsElevenBMinusFourteen: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
            ])([])([])([])([])([])([])([])))
            assertEq(lines.line11b.value, 5000000n)
            assertEq(lines.line14.value, 1575000n)
            assertEq(lines.line15.value, 3425000n)
        },
        // The printed floor: "If zero or less, enter -0-". $5,000 of wages
        // against a $15,750 deduction is -$10,750 before the floor, and the
        // form has no space for that. The control is the leaf above, where the
        // subtraction is positive and passes through untouched — so this is a
        // floor, not a function that returns zero.
        deductionExceedingAdjustedGrossIncomeIsZeroNotNegative: () => {
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('5000.00'),
            ])([])([])([])([])([])([])([])))
            assertEq(lines.line11b.value, 500000n)
            assertEq(lines.line14.value, 1575000n)
            assertEq(lines.line15.value, 0n)
            assert(lines.line15.value >= 0n, ['taxable income must never be negative', lines.line15.value])
        },
    },
    line16: {
        // The IRS's OWN printed Tax Table Example (i1040gi p68: "Mr. and Mrs.
        // Brown are filing a joint return. Their taxable income is $25,300"),
        // reached THROUGH the whole line assembly rather than by handing the
        // dispatcher a number: $56,800.00 of wages less the $31,500.00 joint
        // standard deduction is $25,300.00 of taxable income, and the printed
        // answer is $2,562.00. Every one of those four figures is hand-typed.
        //
        // The METHOD is asserted as well as the cents, and it is the load-
        // bearing half. Bracket arithmetic on the same $25,300.00 gives
        // $2,559.00 — three dollars low, silently — and the QDCGT would give
        // the same $2,562.00 by a different route on a return with no
        // preferential income. Only the tag says which engine ran.
        marriedFilingJointlyTwentyFiveThreeHundredIsThePrintedTaxTableExample: () => {
            const { income, tax, line16Method } = computedLines(
                inputsOf(storedProfile(marriedFilingJointlyProfile))([
                    w2Document('sha256-w2-01')('56800.00'),
                ])([])([])([])([])([])([])([]))
            assertEq(income.line14.value, 3150000n, 'the joint standard deduction, $31,500.00')
            assertEq(income.line15.value, 2530000n, 'taxable income of $25,300.00')
            assertEq(tax.line16.value, 256200n, 'the printed Tax Table Example\'s own answer, $2,562.00')
            assertEq(line16Method, 'taxTable', 'the printed default below $100,000')
            // The rule string names the method too, so a rendered report says
            // which branch produced the number without a second lookup.
            assertEq(tax.line16.rule, '1040 line 16 (Tax Table)')
            // Line 16 cites everything line 15 cited: the wage box and the
            // profile boxes the deduction came from.
            assertEq(tax.line16.sources.length, income.line15.sources.length)
            // 18 = 16 + 17, 21 = 19 + 20, 22 = 18 - 21, 24 = 22 + 23. With
            // every credit and additional tax a declared zero, the tax carries
            // through unchanged — which is the property that makes a wrong
            // line 16 a wrong line 24.
            assertEq(tax.line18.value, 256200n)
            assertEq(tax.line21.value, 0n)
            assertEq(tax.line22.value, 256200n)
            assertEq(tax.line24.value, 256200n)
        },
        // The $100,000 seam, reached through the report: $115,750.00 of wages
        // less the $15,750.00 single standard deduction is exactly $100,000.00
        // of taxable income, where the Tax Table stops and the Tax Computation
        // Worksheet takes over. $16,914.00 is Section A's first printed
        // worksheet row (i1040gi p80, 22% x 100,000.00 - 5,086.00), hand-typed.
        singleAtOneHundredThousandSelectsTheTaxComputationWorksheet: () => {
            const { income, tax, line16Method } = computedLines(
                inputsOf(storedProfile(singleProfile))([
                    w2Document('sha256-w2-01')('115750.00'),
                ])([])([])([])([])([])([])([]))
            assertEq(income.line15.value, 10000000n, 'taxable income of exactly $100,000.00')
            assertEq(tax.line16.value, 1691400n, 'Section A\'s first printed worksheet row, $16,914.00')
            assertEq(line16Method, 'taxComputationWorksheet')
            assertEq(tax.line16.rule, '1040 line 16 (Tax Computation Worksheet)')
        },
    },
    line22: {
        // The printed floor, at the one place a proof can reach it. Line 21 is
        // `19 + 20` and both are profile-declared zeros in this phase, so no
        // whole report can drive line 21 above line 18 — see
        // {@link line22TaxLessNonrefundableCredits} for why that makes the
        // floor an equivalent mutant when driven through the report alone.
        //
        // $1,000.00 of tax against $1,500.00 of nonrefundable credits is -$500
        // before the floor, and the 1040 has no space for that.
        creditsExceedingTaxFloorAtZeroNeverNegative: () => {
            const line22 = line22TaxLessNonrefundableCredits(
                flooringTestLine(100000n)('1040 line 18'))(
                flooringTestLine(150000n)('1040 line 21'))
            assertEq(line22.value, 0n)
            assert(line22.value >= 0n, ['line 22 must never be negative', line22.value])
            assertEq(line22.rule, '1040 line 22')
        },
        // THE CONTROL for the leaf above: when the tax exceeds the credits the
        // difference passes through untouched. Without it, a line 22 that
        // returned `0n` for every return would pass the floor leaf and nothing
        // else — $1,500.00 of tax less $1,000.00 of credits is $500.00.
        controlTaxExceedingCreditsPassesTheDifferenceThrough: () => {
            const line22 = line22TaxLessNonrefundableCredits(
                flooringTestLine(150000n)('1040 line 18'))(
                flooringTestLine(100000n)('1040 line 21'))
            assertEq(line22.value, 50000n)
        },
    },
    withholding: {
        // 25a is W-2 box 2 over every W-2; 25b is 1099-INT box 4 over every
        // 1099-INT; 25d is their total with 25c. $5,000 + $2,500 = $7,500.00
        // withheld on wages, $10.00 on interest, $7,510.00 in total — all
        // hand-typed.
        //
        // The SOURCE COUNT is asserted alongside every value, and it is the
        // half that sees a dropped term: 25d citing three boxes instead of
        // four is a line that quietly stopped counting one of the taxpayer's
        // forms. Four = two W-2 box-2 citations, one 1099-INT box-4 citation,
        // and the profile's `declaredKinds` box behind the legitimately zero
        // line 25c.
        twentyFiveDSumsTwentyFiveAAndTwentyFiveBCitingEveryBox: () => {
            const { tax } = computedLines(inputsOf(storedProfile(withholdingProfile))([
                w2WithWithholding('sha256-w2-01')('50000.00')('5000.00'),
                w2WithWithholding('sha256-w2-02')('25000.00')('2500.00'),
            ])([
                interestDocument('sha256-int-01')({
                    box1InterestIncome: '100.00',
                    box4FederalIncomeTaxWithheld: '10.00',
                }),
            ])([])([])([])([])([])([]))
            assertEq(tax.line25a.value, 750000n, '$7,500.00 withheld on wages')
            assertEq(tax.line25a.sources.length, 2)
            const [firstW2Source] = tax.line25a.sources
            assertEq(firstW2Source.documentHash, 'sha256-w2-01')
            assertEq(firstW2Source.boxPath, 'box2FederalIncomeTaxWithheld')
            assertEq(firstW2Source.value, '5000.00')
            assertEq(tax.line25b.value, 1000n, '$10.00 withheld on interest')
            assertEq(tax.line25b.sources.length, 1)
            const [interestSource] = tax.line25b.sources
            assertEq(interestSource.boxPath, 'box4FederalIncomeTaxWithheld')
            assertEq(tax.line25c.value, 0n)
            assertEq(tax.line25d.value, 751000n, '$7,510.00 of total withholding')
            assertEq(tax.line25d.sources.length, 4)
            // 33 = 25d + 26 + 32, and with no estimated payments and no
            // refundable credits it is the withholding total.
            assertEq(tax.line33.value, 751000n)
        },
    },
    refundOrAmountOwed: {
        // Payments exceeding the tax are an OVERPAYMENT on line 34, and line
        // 37 is zero. $3,000.00 withheld against the printed example's
        // $2,562.00 of tax leaves $438.00 — hand-typed, not computed here from
        // the other two.
        //
        // Its control is `taxExceedingPaymentsIsTheAmountOwedOnLineThirtySeven`
        // below, the same return with the withholding removed: without it, a
        // report that put every difference on line 34 would pass this leaf.
        paymentsExceedingTaxAreAnOverpaymentOnLineThirtyFour: () => {
            const { tax } = computedLines(inputsOf(storedProfile(withholdingProfile))([
                w2WithWithholding('sha256-w2-01')('56800.00')('3000.00'),
            ])([])([])([])([])([])([])([]))
            assertEq(tax.line24.value, 256200n, 'the printed example\'s $2,562.00 of tax')
            assertEq(tax.line33.value, 300000n, '$3,000.00 of total payments')
            assertEq(tax.line34.value, 43800n, 'an overpayment of $438.00')
            assertEq(tax.line37.value, 0n, 'nothing is owed when the return overpaid')
        },
        // THE CONTROL for the leaf above, and the mirror case: the SAME wages
        // with nothing withheld owes the whole $2,562.00 on line 37, and line
        // 34 is zero. A report that swapped the two directions turns both this
        // leaf and its partner red, which is what says the pair is testing the
        // direction rather than the subtraction.
        taxExceedingPaymentsIsTheAmountOwedOnLineThirtySeven: () => {
            const { tax } = computedLines(
                inputsOf(storedProfile(marriedFilingJointlyProfile))([
                    w2Document('sha256-w2-01')('56800.00'),
                ])([])([])([])([])([])([])([]))
            assertEq(tax.line24.value, 256200n)
            assertEq(tax.line33.value, 0n, 'nothing was withheld and nothing was paid in')
            assertEq(tax.line34.value, 0n, 'a return that underpaid has no overpayment')
            assertEq(tax.line37.value, 256200n, '$2,562.00 owed')
        },
        // The seam between them: payments EXACTLY equal to the tax leave both
        // lines zero. The two can never both be non-zero, and this is the one
        // input where a `>=` written for a `>` on either line would show.
        paymentsExactlyEqualToTaxLeaveBothLinesZero: () => {
            const { tax } = computedLines(inputsOf(storedProfile(withholdingProfile))([
                w2WithWithholding('sha256-w2-01')('56800.00')('2562.00'),
            ])([])([])([])([])([])([])([]))
            assertEq(tax.line24.value, 256200n)
            assertEq(tax.line33.value, 256200n)
            assertEq(tax.line34.value, 0n)
            assertEq(tax.line37.value, 0n)
        },
    },
    profileDeclaredAmounts: {
        // Lines 26, 35a and 36 have no IRS form behind them — there is no
        // document for "I sent four cheques" or "apply my refund to next
        // year" — so they come off the return profile's own money boxes, each
        // citing the box it was read from with the raw string as stored.
        //
        // A profile-only return: $1,234.56 of estimated payments against a
        // return with no income at all, so line 24 is zero and the whole
        // payment is an overpayment. Every figure hand-typed.
        linesTwentySixThirtyFiveAAndThirtySixComeOffTheProfilesOwnBoxes: () => {
            const { tax } = computedLines(inputsOf(storedProfile({
                ...marriedFilingJointlyProfile,
                declaredKinds: ['wages', 'taxableInterest', 'estimatedTaxPayments'],
                line26EstimatedTaxPayments: '1234.56',
                line35aRefundRequested: '1000.00',
                line36AppliedToNextYear: '234.56',
            }))([])([])([])([])([])([])([])([]))
            assertEq(tax.line26.value, 123456n)
            assertEq(tax.line26.sources.length, 1)
            const [estimatedSource] = tax.line26.sources
            assertEq(estimatedSource.documentHash, profileHash)
            assertEq(estimatedSource.boxPath, 'line26EstimatedTaxPayments')
            // The raw stored string, quoted exactly — never re-formatted.
            assertEq(estimatedSource.value, '1234.56')
            assertEq(tax.line33.value, 123456n)
            assertEq(tax.line24.value, 0n, 'no income, no tax')
            assertEq(tax.line34.value, 123456n, 'the whole payment is an overpayment')
            assertEq(tax.line35a.value, 100000n, '$1,000.00 refunded now')
            assertEq(tax.line36.value, 23456n, '$234.56 applied to next year')
        },
        // DOC-11 at the profile's own boxes, and the CONTROL for the leaf
        // above: an ABSENT box is absent, never a stored `'0.00'`. The value
        // cannot see the difference — both are zero — so the citation is the
        // only observer, and an absent box cites the DECLARATION that makes
        // the line zero rather than quoting a box that carries nothing.
        anAbsentProfileMoneyBoxIsAZeroCitingTheDeclaration: () => {
            const { tax } = computedLines(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([]))
            assertEq(tax.line26.value, 0n)
            assertEq(tax.line26.sources.length, 1)
            const [only] = tax.line26.sources
            assertEq(only.boxPath, 'declaredKinds')
            assertEq(only.value, singleProfileDeclaredKindsRendering)
            assertEq(tax.line35a.value, 0n)
            assertEq(tax.line36.value, 0n)
        },
    },
    wholeReport: {
        // ROADMAP criterion 1 over the WHOLE return: all 56 printed money
        // lines, 1a through 37, each citing at least one document and each
        // naming the rule it implements.
        //
        // The loop's iteration set comes from the produced list — i.e. from
        // the code under test — so on its own it could never notice a line
        // disappearing. {@link expectedWholeReportLineCount} is the
        // independently hand-typed count that closes it, and the DISTINCT rule
        // count closes the other direction: a line duplicated into the list in
        // place of another keeps the length at 56 and would otherwise pass.
        everyOneOfTheFiftySixLinesCitesADocumentAndNamesItsRule: () => {
            const outcome = computeForm1040(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['an in-scope return must compute', outcome])
            assertEq(
                outcome.lines.length,
                expectedWholeReportLineCount,
                ['expected exactly the independently-stated printed line count', outcome.lines.length],
            )
            assertEq(
                new Set(outcome.lines.map(line => line.rule)).size,
                expectedWholeReportLineCount,
                ['every printed line must name its OWN rule', outcome.lines.map(line => line.rule)],
            )
            for (const line of outcome.lines) {
                assert(
                    line.sources.length > 0,
                    ['a line with no citation is a silently omitted line', line.rule],
                )
                assert(line.rule !== '', 'a line must name the rule it implements')
            }
            assertEq(outcome.line16Method, 'taxTable', 'no taxable income is still a tagged method')
        },
    },
    form1040Report: {
        // ROADMAP criterion 4, on the profile this phase was written for. The
        // 65+ joint return with dependents ORIGINALLY declared TWO kinds this
        // engine did not model, and the WHOLE report was an error naming
        // both — not a 1040 with two quiet zeros on it.
        //
        // **Rewritten in place a SECOND time, by Plan 13-10** (Phase 13 Wave
        // 4, TAX-12): `childTaxCreditOrOtherDependents` — the one kind Plan
        // 13-04 left refusing when it rewrote this leaf the first time
        // (see git history for that version) — moved to `fjs/return/scope`'s
        // `modeledKinds` in this plan's own Task 2, so `sixtyFivePlusProfile`
        // no longer has ANY unavoidable refusal left. This is the closing
        // moment 13-04-SUMMARY.md's own "Next Phase Readiness" section named:
        // "Slice 4 ... is what finally lets this specific declared profile
        // compute end to end without any refusal." The mechanical adaptation
        // is the same one Plan 13-02's own
        // `iraDistributionsAndPensionsAndAnnuitiesNowComputeThroughTheFullReport`
        // leaf narrates for the first reclassification in this chain: renamed
        // and rewritten to assert what the profile now DOES rather than what
        // it still refuses.
        //
        // `sixtyFivePlusProfile` declares `dependentCount: 2` but carries no
        // `dependents` ARRAY (it pre-dates Plan 13-08's addition of that
        // per-dependent detail) — so line 19/28 are legitimately `$0.00` here,
        // through `fjs/form8812`'s own STOP arm (zero qualifying children,
        // zero other dependents), never through a `declaredZero` placeholder.
        // Task 3's own `wave4Dependents` section below is where a profile
        // WITH real per-dependent facts gets a real, non-zero credit.
        //
        // THE CONTROL for this leaf is
        // `controlTheSixtyFivePlusProfileWithoutThoseTwoKindsComputesLinesOneAToThirtySeven`
        // immediately below: the SAME taxpayer with both kinds undeclared
        // computes identically, since the wiring is unconditional — this leaf
        // proves DECLARING the two kinds no longer changes the outcome at
        // all, the strongest form of "in scope" this pair of fixtures can
        // state.
        theSixtyFivePlusProfileNowComputesEndToEndClosingThePhase: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(sixtyFivePlusProfile))([
                    w2Document('sha256-w2-01')('60000.00'),
                ])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the 65+ declared profile to compute now', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(
                outcome.lines.length,
                expectedWholeReportLineCount,
                ['the flagship profile must produce the FULL line set, not a partial one', outcome.lines.length],
            )
            assertEq(
                lineRuled(outcome.lines)('1040 line 19').value, 0n,
                '$0.00 -- dependentCount alone carries no per-dependent facts for form8812 to classify',
            )
            assertEq(lineRuled(outcome.lines)('1040 line 28').value, 0n, '$0.00, the same STOP')
            assertEq(lineRuled(outcome.lines)('1040 line 37').value, 133300n, 'identical to the control below')
            // Cross-checked against the control immediately below: declaring
            // the two now-modeled kinds must produce a BYTE-IDENTICAL report
            // to not declaring them at all.
            const controlOutcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(sixtyFivePlusProfileWithinScope))([
                    w2Document('sha256-w2-01')('60000.00'),
                ])([])([])([])([])([])([])([]))
            assert(controlOutcome.kind === 'ok', ['expected the control to compute', controlOutcome])
            if (controlOutcome.kind === 'ok') {
                // `assertEq` is `===`, so two DIFFERENT arrays (even with
                // identical bigint contents) never compare equal by
                // reference — joined into a single string first, as bigints
                // are not `JSON.stringify`-able either.
                assertEq(
                    outcome.lines.map(line => line.value).join(','),
                    controlOutcome.lines.map(line => line.value).join(','),
                    'declaring vs. not declaring the two now-modeled kinds must produce the SAME figures',
                )
            }
        },
        // THE CONTROL for `theSixtyFivePlusProfileNowRefusesNamingOnlyTheRemainingUnmodeledKind`:
        // the SAME taxpayer — both age boxes checked, both dependents declared
        // — with only the two unmodeled kinds removed from the declaration.
        // Lines 1a-37 compute end to end.
        //
        // **Re-derived by Plan 13-04** (Phase 13 Wave 2, TAX-09): this
        // fixture's expected figures pre-date Schedule 1-A's wiring, when
        // line 13b was still an inert `declaredZero`. Line 13b now reads
        // Schedule 1-A UNCONDITIONALLY off the profile's own age boxes —
        // exactly like lines 3a/3b/4a-6b already do off documents — and
        // this profile has BOTH taxpayer and spouse age boxes checked
        // (`taxpayerBornBeforeJan2_1961`/`spouseBornBeforeJan2_1961`), so it
        // now legitimately receives the FULL $12,000.00 combined senior
        // deduction (line36a $6,000.00 + line36b $6,000.00, since
        // $60,000.00 AGI is well under the $150,000.00 MFJ phase-out start
        // — Schedule 1-A's own `mfjBothSpousesQualifyingGetsDoubleTheSamePhaseOutAmount`
        // fixture, `fjs/schedule/1a`, is this exact shape). The old
        // "$25,300.00 taxable income, the IRS's own printed Tax Table
        // Example" narrative no longer holds for THIS profile — it held
        // only while line 13b was a placeholder zero — so every figure
        // below is RE-HAND-COMPUTED: $34,700.00 standard deduction (12e) +
        // $12,000.00 senior deduction (13b) = $46,700.00 (14); $60,000.00 -
        // $46,700.00 = $13,300.00 taxable income (15); Tax Table on
        // $13,300.00 MFJ = $1,333.00 (16/37) — independently cross-checked
        // below via a direct `baseTaxForAmount(...)` call, never assumed.
        controlTheSixtyFivePlusProfileWithoutThoseTwoKindsComputesLinesOneAToThirtySeven: () => {
            const inputs = inputsOf(storedProfile(sixtyFivePlusProfileWithinScope))([
                w2Document('sha256-w2-01')('60000.00'),
            ])([])([])([])([])([])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['the same profile within scope must compute', outcome])
            assertEq(
                outcome.lines.length,
                expectedWholeReportLineCount,
                ['the control must produce the FULL line set, not a partial one', outcome.lines.length],
            )
            assertEq(outcome.line16Method, 'taxTable')
            assertEq(lineRuled(outcome.lines)('1040 line 12e').value, 3470000n, 'two age boxes, $34,700.00')
            assertEq(
                lineRuled(outcome.lines)('1040 line 13b').value, 1200000n,
                '$12,000.00 -- BOTH spouses 65+, well under the $150,000 MFJ phase-out start',
            )
            assertEq(lineRuled(outcome.lines)('1040 line 14').value, 4670000n, '$34,700.00 + $12,000.00')
            assertEq(lineRuled(outcome.lines)('1040 line 15').value, 1330000n, 'taxable income of $13,300.00')
            assertEq(lineRuled(outcome.lines)('1040 line 16').value, 133300n, 'Tax Table on $13,300.00 MFJ')
            assertEq(lineRuled(outcome.lines)('1040 line 37').value, 133300n, 'and all of it is owed')
            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own line-16 dispatch: the SAME taxable income fed straight to
            // `baseTaxForAmount(...)` (never to `dispatchLine16`) must reach
            // the identical cents.
            const crossCheck = baseTaxForAmount(taxParams2025)('marriedFilingJointly')(1330000n)
            assertEq(crossCheck.method, 'taxTable')
            assertEq(crossCheck.cents, 133300n, 'independent baseTaxForAmount(...) call must reach the SAME figure')
            // Line 15 is unchanged from what the income lines alone produce:
            // the guard decides WHETHER a return is computed, never WHAT it
            // computes.
            assertEq(
                lineRuled(outcome.lines)('1040 line 15').value,
                expectIncomeOk(form1040IncomeLines(taxParams2025)(inputs)).line15.value,
            )
        },
        // A second, independent refusal, on a kind whose remedy is a missing
        // FORM rather than a missing worksheet: unreported tips need Form
        // 4137, which no phase has shipped. Its control is
        // `controlTheSameDeclarationWithoutUnreportedTipsComputes`
        // immediately below.
        //
        // Re-pointed from `socialSecurityBenefits` to `unreportedTips` by
        // Plan 13-02 (Phase 13 Wave 1, TAX-10): `socialSecurityBenefits`
        // moved to `fjs/return/scope`'s `modeledKinds` in this plan's own
        // Task 2, so declaring it no longer refuses at all — this leaf's
        // whole premise (a coarse-kind refusal naming a missing dialect)
        // stopped being true the instant the kind was reclassified. The
        // PROPERTY this leaf proves — `form1040Report` threads a
        // `fjs/return/scope` refusal end to end, naming the kind, the line
        // and the remedy — is preserved verbatim against `unreportedTips`,
        // which stays refused for the rest of this phase (Decision 1.4).
        // `socialSecurityBenefits` itself now has its OWN "actually computes"
        // coverage: `retirementAndSocialSecurityBeforeTheScopeReclassificationLands`
        // above and `wave1RetirementAndSocialSecurity` below.
        unreportedTipsRefuseTheWholeReportNamingTheLineAndTheRemedy: () => {
            const outcome = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                declaredKinds: ['wages', 'taxableInterest', 'unreportedTips'],
            }))([w2Document('sha256-w2-01')('50000.00')])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'error', ['a declared unmodeled kind must refuse', outcome])
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one unmodeled kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected the declared kind named', outcome.unmodeled])
            assert(
                outcome.message.includes('1040 line 1c'),
                ['expected the refusal to name the 1040 line', outcome.message],
            )
            assert(
                outcome.message.includes('Form 4137'),
                ['expected the refusal to name the missing form', outcome.message],
            )
        },
        // THE CONTROL for the leaf above: the same return with unreported
        // tips removed from the declaration computes, and its own line 1c is
        // legitimately zero rather than refused. That distinction — a zero
        // the taxpayer declared versus an input the engine cannot model — is
        // the entire reason the return profile exists (Decision 4).
        controlTheSameDeclarationWithoutUnreportedTipsComputes: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([
                    w2Document('sha256-w2-01')('50000.00'),
                ])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['dropping the unmodeled kind must compute', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 1c').value, 0n, 'legitimately zero, not refused')
            assertEq(lineRuled(outcome.lines)('1040 line 15').value, 3425000n, '$50,000 less $15,750')
        },
        // T-10-10-02, asserted STRUCTURALLY rather than by inspecting a
        // length: the error arm carries no `lines` key AT ALL. An empty array
        // would be a partial 1040 a renderer would happily draw as a form of
        // zeros; the absence of the key means there is nothing to draw.
        //
        // `Object.hasOwn`, not `in` and not `!== undefined` — the guard
        // comparison AGENTS.md records from the `match` prototype hazard,
        // where two of the three obvious checks answer the wrong question.
        // The `ok` half in the same leaf is its control: the key IS present
        // there, so this is a property of the ERROR arm and not of the
        // predicate.
        //
        // **Re-pointed by Plan 13-10** (Phase 13 Wave 4, TAX-12):
        // `sixtyFivePlusProfile` no longer refuses at all (both of its own
        // kinds are modeled now — see
        // `theSixtyFivePlusProfileNowComputesEndToEndClosingThePhase`,
        // above), so this leaf's own refusing half needs a fixture that still
        // refuses. Re-pointed at `unreportedTips` (Decision 1.4, stays
        // refused for the rest of this phase) for the ERROR half, and at
        // `singleProfile` (always in scope) for the OK half — the PROPERTY
        // this leaf proves (the error arm carries no `lines` key at all; the
        // ok arm does) is unchanged, only the fixtures are.
        theErrorArmCarriesNoLinesFieldAtAll: () => {
            const refused = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'taxableInterest', 'unreportedTips'],
                }))([])([])([])([])([])([])([])([]))
            assert(refused.kind === 'error', ['expected a refusal', refused])
            assert(
                !Object.hasOwn(refused, 'lines'),
                ['a refused return must carry no line list at all', Object.keys(refused)],
            )
            const computed = form1040Report(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([]))
            assert(computed.kind === 'ok', ['expected the control to compute', computed])
            assert(
                Object.hasOwn(computed, 'lines'),
                ['a computed return must carry its line list', Object.keys(computed)],
            )
        },
        // ROADMAP criterion 5 through the ENTRY POINT, with the election read
        // off the taxpayer's own profile box. Ten stored 1099-INTs at the
        // IRS's printed example amount of `'1.39'`: the exact cents sum is
        // $13.90, and the election rounds that ONCE to $14.
        //
        // The all-or-nothing half is asserted over every line of the report,
        // not only line 2b — p23 makes the election apply to the whole return,
        // so a report where one line kept its cents would not be a rounded
        // return.
        theWholeDollarElectionRoundsEveryLineOfTheReportOnce: () => {
            const outcome = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                wholeDollarElection: true,
            }))([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the elected return to compute', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 2b').value, 1400n, '$14, rounded once')
            for (const line of outcome.lines) {
                assertEq(
                    line.value % 100n,
                    0n,
                    ['the election is all-or-nothing for the whole return', line.rule, line.value],
                )
            }
        },
        // THE CONTROL for the leaf above: the same ten documents WITHOUT the
        // election keep their cents — $13.90 — so the election is an election
        // and not something the report does anyway. `1390n` and `1400n` are
        // both hand-typed and neither is derived from the other.
        controlWithoutTheElectionTheSameTenDocumentsKeepTheirCents: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the unelected return to compute', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 2b').value, 1390n, '$13.90, cents intact')
        },
        // The two guards are SIBLINGS and neither subsumes the other.
        //
        // A profile-only return — no W-2, no 1099-INT — still READS the
        // profile document, so it passes `fjs/report/guard`'s zero-observed-
        // reads kill condition (proven there, not restated here) and then
        // either computes with every line legitimately zero, or refuses on
        // scope. This asserts the computing case, and asserts the read that
        // makes it pass the other gate: the profile is cited by real lines.
        //
        // `classifyRunOutcome` catches "computed nothing"; the scope guard
        // catches "computed only part of the return and said nothing". Both
        // must keep passing; neither can stand in for the other.
        scopeGuardAndZeroReadGuardAreOrthogonal: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['a return of legitimate zeros must compute', outcome])
            assertEq(outcome.lines.length, expectedWholeReportLineCount)
            const readsOfTheProfile = outcome.lines.filter(
                line => line.sources.some(source => source.documentHash === profileHash))
            assert(
                readsOfTheProfile.length > 0,
                ['a profile-only return still observes a read, so the zero-read gate does not fire', readsOfTheProfile.length],
            )
            assertEq(lineRuled(outcome.lines)('1040 line 1a').value, 0n)
            assertEq(lineRuled(outcome.lines)('1040 line 12e').value, 1575000n, 'the deduction is not zero')
        },
    },
    // ROADMAP criterion 5, on a REAL line aggregating ten REAL documents.
    //
    // Criterion 5 as written is a tautology: over `bigint` cents `round(sum)`
    // and `sum(round)` are both the identity, so proving them equal tests
    // nothing (10-CONTEXT.md Decision 5). Rounding only bites at WHOLE
    // DOLLARS, which is what the taxpayer's p23 election introduces — and here
    // the two orders visibly diverge by $4 on money that came out of ten
    // stored documents through the real line assembly.
    //
    // `fjs/report/line`'s
    // `roundSumIsFourteenDollarsWhileSumRoundIsTenOnTenIrsExampleAmounts`
    // proves the same divergence on a hand-built `ReportLine`; this leaf is
    // the one criterion 5 actually asks for — "a line aggregating ten or more
    // documents with real cents" — and it does not restate that one.
    //
    // `1390n`, `1400n`, `1000n`, `400n` and the count `10` are ALL hand-typed.
    // None is computed from `139n`, none from another, and none by calling the
    // election: an expected value is worth exactly as much as its independence
    // from the code it checks (AGENTS.md).
    criterionFiveRoundSumOverTenInterestDocuments: () => {
        assertEq(tenInterestDocumentsAtOneThirtyNine.length, 10)
        const profile = storedProfile(singleProfile)

        // The IRS's way: ONE line whose value is the exact cents sum of its
        // ten sources, rounded once.
        const { line2b } = expectIncomeOk(form1040IncomeLines(taxParams2025)(
            inputsOf(profile)([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([])))
        assertEq(line2b.value, 1390n)
        assertEq(line2b.sources.length, 10)
        const roundOfSum = assertNotNullish(
            applyWholeDollarElection(true)([line2b])[0],
            'the projection of a one-line report must have a line 0').value
        // $14 — the amount the IRS instructs the taxpayer to enter.
        assertEq(roundOfSum, 1400n)

        // The forbidden way, introduced where it would actually be introduced:
        // assemble each document into its OWN line 2b, round each, then add.
        const sumOfRounds = tenInterestDocumentsAtOneThirtyNine.reduce(
            (total, document) => total + assertNotNullish(
                applyWholeDollarElection(true)([
                    expectIncomeOk(form1040IncomeLines(taxParams2025)(
                        inputsOf(profile)([])([document])([])([])([])([])([])([]))).line2b,
                ])[0],
                'the projection of a one-document report must have a line 0').value,
            0n)
        // $10 — thirty-nine cents lost ten times over.
        assertEq(sumOfRounds, 1000n)

        // Name the SIZE of the divergence, not merely one side of it: $4.
        assertEq(roundOfSum - sumOfRounds, 400n)
        assert(roundOfSum !== sumOfRounds, 'round(sum) must diverge from sum(round) at whole dollars')
    },
    // ROADMAP criterion 1 at the report layer: EVERY line cites at least one
    // document, the legitimately zero ones included.
    //
    // The loop's iteration set comes from the produced record — i.e. from the
    // code under test — so on its own it could never notice a line
    // disappearing. {@link expectedLineCount} is the independently hand-typed
    // count that closes it (AGENTS.md's `expectedMoneyBoxFieldCount` idiom).
    everyLineCitesAtLeastOneDocument: () => {
        const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
            inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])))
        assertEq(
            incomeLineFieldNames.length,
            expectedIncomeLineCount,
            ['expected exactly the independently-stated printed line count', incomeLineFieldNames.length],
        )
        for (const name of incomeLineFieldNames) {
            const line = lines[name]
            assert(line.sources.length > 0, ['a line with no citation is a silently omitted line', name])
            assert(line.rule !== '', ['a line must name the rule it implements', name])
        }
    },
    // Plan 12.1-04 Task 1: dividend income and Schedule D reach REAL lines —
    // 3a/3b/7a, and the dispatch call site — while the six-kind scope
    // reclassification has NOT landed yet (Task 2). See this plan's own
    // <objective> for why that ordering is safe.
    dividendsAndScheduleDBeforeTheScopeReclassificationLands: {
        // The mixed-dividends fixture Mutation Gate M5 (Task 3) targets:
        // `box1aTotalOrdinaryDividends: '1000.00'`,
        // `box1bQualifiedDividends: '500.00'`, no problematic kind declared.
        // Reached through the FULL `form1040Report(...)` entry point, so the
        // outer scope guard runs too (and passes, since neither
        // `qualifiedDividends` nor `ordinaryDividends` is declared).
        //
        // Wages of $50,000.00 plus $1,000.00 of ordinary dividends less the
        // $31,500.00 MFJ standard deduction is $19,500.00 of taxable income
        // — hand-computed independently of this leaf's own assertions below.
        // Line 16 is cross-checked against a SEPARATE, direct call to the
        // already-proven `qdcgt` (its own arithmetic is exhaustively covered,
        // with a mutation gate, in `fjs/tax/line16/qdcgt`), fed the fixture's
        // own hand-known dividend figures and the independently-derived
        // taxable income — never a value read back off the code under test.
        mixedDividendsComputeRealLinesThreeAThreeBSevenAAndANonZeroLineSixteen: () => {
            const dividendForm = dividendDocument('sha256-div-mixed')({
                box1aTotalOrdinaryDividends: '1000.00',
                box1bQualifiedDividends: '500.00',
            })
            const inputs = inputsOf(storedProfile(marriedFilingJointlyProfile))([
                w2Document('sha256-w2-div-01')('50000.00'),
            ])([])([dividendForm])([])([])([])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected a legitimate, in-scope return to compute', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 3a').value, 50000n, '$500.00 qualified dividends')
            assertEq(lineRuled(outcome.lines)('1040 line 3b').value, 100000n, '$1,000.00 ordinary dividends')
            assertEq(lineRuled(outcome.lines)('1040 line 7a').value, 0n, 'no capital gain distribution box')
            assertEq(lineRuled(outcome.lines)('1040 line 15').value, 50000n + 1900000n, '$19,500.00 taxable income')
            assertEq(outcome.line16Method, 'qdcgt', 'branch 2c: qualified dividends select the QDCGT')
            const line16 = lineRuled(outcome.lines)('1040 line 16').value
            assert(line16 > 0n, ['expected a real, non-zero line 16', line16])
            const crossCheck = qdcgt(taxParams2025)({
                status: 'marriedFilingJointly',
                line1Cents: 1950000n,
                line2Cents: 50000n,
                filingScheduleD: false,
                scheduleD15Cents: 0n,
                scheduleD16Cents: 0n,
                line7aCents: 0n,
            }).line25
            assertEq(line16, crossCheck, 'the wiring must feed the SAME facts an independent qdcgt call would')
            // filingScheduleD is not part of a rendered ReportLine — checked
            // through a direct income-lines call on the SAME inputs.
            const income = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputs))
            assertEq(income.filingScheduleD, false)
        },
        // The SAME shape, but the 1099-DIV also carries a capital gain
        // distribution (box 2a): line 7a picks it up (dispatcher branch 2d's
        // case), still with `filingScheduleD === false`.
        capitalGainDistributionBoxFeedsLineSevenAWithoutFilingScheduleD: () => {
            const dividendForm = dividendDocument('sha256-div-mixed-with-2a')({
                box1aTotalOrdinaryDividends: '1000.00',
                box1bQualifiedDividends: '500.00',
                box2aTotalCapitalGainDistr: '200.00',
            })
            const inputs = inputsOf(storedProfile(marriedFilingJointlyProfile))([
                w2Document('sha256-w2-div-02')('50000.00'),
            ])([])([dividendForm])([])([])([])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected a legitimate, in-scope return to compute', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 7a').value, 20000n, '$200.00 capital gain distribution')
            const income = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputs))
            assertEq(income.filingScheduleD, false)
        },
        // A profile DECLARING `capitalGainsOrLosses` with a clean-gain 1099-B
        // (basis and proceeds both present): tested by calling
        // `form1040IncomeLines(...)` DIRECTLY, never through `form1040Report`
        // — `capitalGainsOrLosses` is still in `unmodeledKindRefusals` at the
        // end of Task 1, so the outer guard would refuse the whole return for
        // that unrelated, pre-existing reason before this task's new wiring
        // is ever reached. Testing the new code in isolation is the only way
        // to exercise it this task.
        //
        // `scheduleD(...)`'s own output is the comparison target — never a
        // hand-typed cents literal here — because this leaf tests WIRING
        // (did `form1040IncomeLines` thread Schedule D's real output onto
        // line 7a and the four dispatcher-input fields?), not Schedule D's
        // own arithmetic, which `fjs/schedule/d`'s own proof already covers
        // exhaustively.
        cleanGainDeclaredScheduleDWiresLineSevenAAndTheFourDispatcherFields: () => {
            const brokerageForm = brokerageDocument('sha256-b-clean-gain')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])([])([brokerageForm])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the income lines to compute in isolation', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(outcome.filingScheduleD, true, 'the declared kind must select Schedule D')
            const independentScheduleD = scheduleD({
                status: 'single',
                brokerageForms: [brokerageForm],
                dividendForms: [],
            })
            assert(independentScheduleD.kind === 'ok', ['expected Schedule D to compute', independentScheduleD])
            if (independentScheduleD.kind !== 'ok') {
                throw ['expected ok', independentScheduleD]
            }
            assertEq(outcome.line7a.value, independentScheduleD.line7aCapitalGainOrLoss)
            assertEq(outcome.scheduleD15Cents, independentScheduleD.line15)
            assertEq(outcome.scheduleD16Cents, independentScheduleD.line16)
            assertEq(outcome.scheduleD18Cents, independentScheduleD.line18)
            assertEq(outcome.scheduleD19Cents, independentScheduleD.line19)
        },
        // 12.1-VERIFICATION.md's WARNING: the leaf above's fixture has NO
        // 1099-DIV at all, so `independentScheduleD.line18`/`.line19` are
        // BOTH `0n` on the real code path AND on a hypothetical
        // hardcoded-zero mutant at this file's own `scheduleD18Cents`/
        // `scheduleD19Cents` construction (lines 619-620 above) — the
        // wiring assertions `outcome.scheduleD18Cents ===
        // independentScheduleD.line18` (and the line19 sibling) pass
        // identically either way for that fixture. AGENTS.md names four
        // prior instances of exactly this shape: a proof whose expected
        // side is not independent of the code under test.
        //
        // This sibling fixture adds a 1099-DIV carrying box 2b
        // (unrecaptured section 1250 gain) and box 2d (28%-rate
        // collectibles gain) — the natural source per 12.1-CONTEXT.md's own
        // "SCOPE — what becomes modeled" decisions — so
        // `scheduleD18Cents`/`scheduleD19Cents` are NON-ZERO and the SAME
        // two assertions become load-bearing.
        //
        // MUTATION-VERIFIED (recorded here per this plan's own
        // instruction): hardcoding `scheduleD18Cents: 0n` at this file's
        // line 619 (`scheduleD18Cents: scheduleDOk === undefined ? 0n :
        // scheduleDOk.line18,`) reddens exactly this leaf, at exactly
        // `assertEq(outcome.scheduleD18Cents, independentScheduleD.line18)`
        // below — `50000n !== 0n`. Reverting restores green. Separately
        // hardcoding `scheduleD19Cents: 0n` at line 620 reddens the SAME
        // leaf at the matching `scheduleD19Cents` assertion — `30000n !==
        // 0n`. Neither mutation touches the leaf above, which stays green
        // throughout (its own two assertions are still `0n === 0n`,
        // unaffected) — confirming this new leaf, not the old one, is what
        // now carries the load.
        nonDegenerateGainWiresLineEighteenAndLineNineteenWhenBothAreNonZero: () => {
            const brokerageForm = brokerageDocument('sha256-b-1250-and-28pct-gain')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const dividendForm = dividendDocument('sha256-div-1250-and-28pct')({
                box2bUnrecapSec1250Gain: '300.00',
                box2dCollectibles28PercentGain: '500.00',
            })
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])(
                [dividendForm])([brokerageForm])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the income lines to compute in isolation', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            const independentScheduleD = scheduleD({
                status: 'single',
                brokerageForms: [brokerageForm],
                dividendForms: [dividendForm],
            })
            assert(independentScheduleD.kind === 'ok', ['expected Schedule D to compute', independentScheduleD])
            if (independentScheduleD.kind !== 'ok') {
                throw ['expected ok', independentScheduleD]
            }
            // Hand-typed and independent of the code under test — the
            // fixture's own $500.00 box 2d and $300.00 box 2b, never
            // derived from `outcome` or `independentScheduleD`.
            assertEq(independentScheduleD.line18, 50000n, '$500.00 box 2d, hand-typed')
            assertEq(independentScheduleD.line19, 30000n, '$300.00 box 2b, hand-typed')
            assertEq(outcome.scheduleD18Cents, independentScheduleD.line18)
            assertEq(outcome.scheduleD19Cents, independentScheduleD.line19)
        },
        // The SAME declared-`capitalGainsOrLosses` profile, but its ONLY
        // 1099-B has `box1dProceeds` present and `box1eCostOrOtherBasis`
        // genuinely absent: `form1040IncomeLines(...)` (called DIRECTLY,
        // same reasoning as above) returns `{ kind: 'error', ... }` — no line
        // constructed at all.
        absentBasisRefusesTheWholeIncomeLinesCallBeforeAnyLineIsBuilt: () => {
            const absentBasisForm = brokerageDocument('sha256-b-absent-basis')({
                box1dProceeds: '10000.00',
                box2LongTermGainOrLoss: true,
                box5NoncoveredSecurity: true,
                // box1eCostOrOtherBasis genuinely OMITTED.
            })
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])([])([absentBasisForm])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(inputs)
            assertEq(outcome.kind, 'error', ['expected the absent-basis refusal to propagate', outcome])
            assert(!Object.hasOwn(outcome, 'line1a'), 'no line may be built once Schedule D refuses')
            // Separately, `form1040Report(...)` on this SAME profile ALSO
            // returns `{ kind: 'error', ... }`. Task 2 has landed:
            // `capitalGainsOrLosses` is a MODELED kind now
            // (`fjs/return/scope`'s `modeledKinds`), so `classifyScope`
            // no longer refuses this profile — the PRE-EXISTING scope
            // refusal this comment used to describe cannot fire here any
            // more. The refusal below arrives via THIS task's own
            // absent-basis mechanism (12.1-CONTEXT.md Decision 2.6): the
            // SAME `Form8949Error`/`ScheduleDOutcome` error arm
            // `form1040IncomeLines` already threaded above, propagated
            // verbatim one function further by `form1040Report`.
            //
            // Distinguished BY MECHANISM, not merely by the shared
            // `kind === 'error'` shape (AGENTS.md: "assert the effect, not
            // the error message" cuts both ways — two different refusals
            // can share a message SHAPE just as two orderings can share a
            // message). A scope refusal would name `capitalGainsOrLosses`
            // in `unmodeled`; the absent-basis mechanism never does —
            // `unmodeled` stays EMPTY — and its `message` names the
            // missing box, which no scope refusal message does.
            const wholeReportOutcome = form1040Report(taxParams2025)(inputs)
            assert(
                wholeReportOutcome.kind === 'error',
                ['expected the whole report to refuse today, via the absent-basis mechanism', wholeReportOutcome],
            )
            if (wholeReportOutcome.kind !== 'error') {
                throw ['expected error', wholeReportOutcome]
            }
            assertEq(
                wholeReportOutcome.unmodeled.length,
                0,
                [
                    'the absent-basis mechanism refuses with an EMPTY unmodeled list — ' +
                        'a scope refusal would instead name capitalGainsOrLosses',
                    wholeReportOutcome.unmodeled,
                ],
            )
            assert(
                wholeReportOutcome.message.includes('box1eCostOrOtherBasis is genuinely absent'),
                ['expected the absent-basis message to name the missing box', wholeReportOutcome.message],
            )
        },
    },
    // Plan 13-02 Task 1 (Slice 1, TAX-10): `vnd.fjs.1099r` and
    // `vnd.fjs.ssa1099` reach REAL lines — 4a/4b/5a/5b/6a/6b, and 25b's
    // now-four-document sum — while the four-kind scope reclassification has
    // NOT landed yet (Task 2). Mirrors 12.1-04's own
    // `dividendsAndScheduleDBeforeTheScopeReclassificationLands` section:
    // these lines read documents UNCONDITIONALLY, with no declaration gate,
    // so they compute real, non-placeholder values even though none of
    // `iraDistributions`/`pensionsAndAnnuities`/`socialSecurityBenefits` is
    // declared — proving the wiring is independent of the declaration,
    // exactly as lines 3a/3b already established for dividends.
    retirementAndSocialSecurityBeforeTheScopeReclassificationLands: {
        // Task 1's own acceptance fixture: one SSA-1099 at $20,000.00, one
        // IRA 1099-R ($10,000.00/$8,000.00), one pension 1099-R
        // ($15,000.00/$15,000.00) — routed by EACH DOCUMENT'S OWN
        // `box7bIraSepSimple` checkbox, never summed uniformly across every
        // 1099-R (13-RESEARCH.md Pitfall 4).
        mixedRetirementFormsRouteToFourAAndFiveAByBoxSevenBAndSixAReadsSsa1099: () => {
            const iraForm = retirementDocument('sha256-r-ira')({
                box1GrossDistribution: '10000.00',
                box2aTaxableAmount: '8000.00',
                box7bIraSepSimple: true,
            })
            const pensionForm = retirementDocument('sha256-r-pension')({
                box1GrossDistribution: '15000.00',
                box2aTaxableAmount: '15000.00',
            })
            const ssaForm = socialSecurityDocument('sha256-ssa-01')('20000.00')
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([iraForm, pensionForm])([ssaForm])([])([])))
            assertEq(lines.line4a.value, 1000000n, '$10,000.00 IRA gross distribution')
            assertEq(lines.line4b.value, 800000n, '$8,000.00 IRA taxable amount')
            assertEq(lines.line5a.value, 1500000n, '$15,000.00 pension gross distribution')
            assertEq(lines.line5b.value, 1500000n, '$15,000.00 pension taxable amount')
            assertEq(lines.line6a.value, 2000000n, '$20,000.00 total SSA-1099 box 5')
            // box7bIraSepSimple ROUTES a document to exactly ONE of the two
            // line pairs, never both — one citation each, from the document
            // this task's own fixture expects.
            assertEq(lines.line4a.sources.length, 1)
            assertEq(lines.line5a.sources.length, 1)
            const [ira4aSource] = lines.line4a.sources
            assertEq(ira4aSource.documentHash, 'sha256-r-ira')
            const [pension5aSource] = lines.line5a.sources
            assertEq(pension5aSource.documentHash, 'sha256-r-pension')
        },
        // line25b now sums FOUR document types: 1099-INT, 1099-R, 1099-DIV
        // and 1099-B, each `box4FederalIncomeTaxWithheld` — matching
        // `federalTaxWithheldOnOther1099`'s own remedy string, which names
        // all three of the latter three (`fjs/return/scope`). $10 + $100 +
        // $50 + $25 = $185.00, hand-typed, never re-derived from the code
        // under test.
        line25bSumsAllFourWithholdingDocumentTypes: () => {
            const retirementForm = retirementDocument('sha256-r-wh')({
                box4FederalIncomeTaxWithheld: '100.00',
            })
            const dividendForm = dividendDocument('sha256-div-wh')({
                box4FederalIncomeTaxWithheld: '50.00',
            })
            const brokerageForm = brokerageDocument('sha256-b-wh')({
                box4FederalIncomeTaxWithheld: '25.00',
            })
            const interestForm = interestDocument('sha256-int-wh')({
                box4FederalIncomeTaxWithheld: '10.00',
            })
            const { tax } = computedLines(
                inputsOf(storedProfile(singleProfile))([])([interestForm])([dividendForm])([brokerageForm])(
                    [retirementForm])([])([])([]))
            assertEq(tax.line25b.value, 18500n, '$185.00 across all four document types')
            assertEq(tax.line25b.sources.length, 4)
        },
        // The IRA-deduction circularity refusal (Decision 3.3/5.1): a
        // profile declaring `iraDeductionDeclared: true` refuses the WHOLE
        // return, naming Pub. 590-A, with an EMPTY `unmodeled` list — a
        // document-data-sufficiency refusal (12.1-CONTEXT.md Decision 2.6),
        // never a `fjs/return/scope` kind.
        iraDeductionDeclaredRefusesNamingPub590ABeforeTheWorksheetRuns: () => {
            const outcome = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile({ ...singleProfile, iraDeductionDeclared: true }))(
                    [])([])([])([])([])([])([])([]))
            assertEq(outcome.kind, 'error', ['expected the IRA-deduction refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('Pub. 590-A Worksheet 1-1'),
                ['expected the refusal to name Pub. 590-A Worksheet 1-1', outcome.message],
            )
            assertEq(outcome.unmodeled.length, 0, ['expected an EMPTY unmodeled list', outcome.unmodeled])
        },
        // THE CONTROL for the leaf above: the same profile WITHOUT the
        // declaration computes normally — the gate is the declaration, not
        // something about this fixture generally.
        controlWithoutIraDeductionDeclaredComputes: () => {
            const outcome = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([]))
            assertEq(outcome.kind, 'ok', ['expected the control to compute', outcome])
        },
        // `mfsLivedWithSpouseAtAnyTimeInYear` is gated on filing STATUS
        // here, never threaded through unconditionally: a profile that sets
        // the flag without ALSO being `marriedFilingSeparately` must not
        // crash `fjs/tax/ssb`'s own internal invariant (Rule 2 — input
        // validation at the boundary). A single filer with the flag set
        // still computes, and line 6b is unaffected (no SSA-1099 income on
        // this fixture, so the worksheet floors at zero regardless).
        mfsFlagIsIgnoredForANonMfsStatusRatherThanCrashing: () => {
            const outcome = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile({ ...singleProfile, mfsLivedWithSpouseAtAnyTimeInYear: true }))(
                    [])([])([])([])([])([])([])([]))
            assertEq(outcome.kind, 'ok', ['expected the flag to be gated, not crash', outcome])
        },
        // Task 2 has landed: `iraDistributions` and `pensionsAndAnnuities`
        // are MODELED kinds now (`fjs/return/scope`'s `modeledKinds`), so
        // `classifyScope` no longer refuses a return declaring either —
        // rewritten IN PLACE from this task's own original "still refuses"
        // assertion (the mechanical adaptation this file's own Schedule D
        // absent-basis leaf, above, already narrates for the identical
        // situation one reclassification earlier). Declaring both together
        // through the FULL `form1040Report(...)` entry point now computes a
        // real, non-placeholder line 4a/4b and 5a/5b from stored 1099-Rs —
        // the property Task 3's own end-to-end proof (below) also covers at
        // the whole-return level, so this leaf keeps the narrower, faster
        // check: the scope guard specifically stops refusing.
        iraDistributionsAndPensionsAndAnnuitiesNowComputeThroughTheFullReport: () => {
            const iraForm = retirementDocument('sha256-r-ira-t2')({
                box1GrossDistribution: '5000.00',
                box2aTaxableAmount: '4000.00',
                box7bIraSepSimple: true,
            })
            const pensionForm = retirementDocument('sha256-r-pension-t2')({
                box1GrossDistribution: '3000.00',
                box2aTaxableAmount: '3000.00',
            })
            const outcome = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                declaredKinds: ['wages', 'taxableInterest', 'iraDistributions', 'pensionsAndAnnuities'],
            }))([])([])([])([])([iraForm, pensionForm])([])([])([]))
            assert(outcome.kind === 'ok', ['expected both kinds to compute now', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(lineRuled(outcome.lines)('1040 line 4a').value, 500000n, '$5,000.00 IRA gross distribution')
            assertEq(lineRuled(outcome.lines)('1040 line 4b').value, 400000n, '$4,000.00 IRA taxable amount')
            assertEq(lineRuled(outcome.lines)('1040 line 5a').value, 300000n, '$3,000.00 pension gross distribution')
            assertEq(lineRuled(outcome.lines)('1040 line 5b').value, 300000n, '$3,000.00 pension taxable amount')
        },
    },
    // Plan 13-04 Task 1 — Slice 2's own wiring, before the scope
    // reclassification lands: line13b reads Schedule 1-A's real Part VI
    // total UNCONDITIONALLY off the profile's own age boxes, exactly like
    // lines 3a/3b and the retirement lines above already established, even
    // though `seniorAndOtherScheduleOneADeductions` is still in
    // `unmodeledKindRefusals` — proving the wiring itself is correct and
    // independent of the declaration.
    seniorDeductionBeforeTheScopeReclassificationLands: {
        // AGI = $80,000.00 exactly (wages alone, no other income) —
        // Schedule 1-A's OWN `continuousPhaseoutSingleAtEightyThousandDollars`
        // fixture (`fjs/schedule/1a`) computed line37/line38 = $5,700.00
        // from this same AGI; this leaf re-derives it through the FULL 1040
        // wiring, calling `form1040IncomeLines` DIRECTLY (bypassing
        // `classifyScope`, since the kind is not declared here at all).
        sixtyFivePlusSingleFilerComputesRealLine13bFromScheduleOneA: () => {
            const w2Form = w2Document('sha256-t4-w2-80k')('80000.00')
            /** @type {ReturnProfile} */
            const profile = { ...singleProfile, taxpayerBornBeforeJan2_1961: true }
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])))
            assertEq(lines.line11b.value, 8000000n, '$80,000.00 AGI -- wages alone')
            assertEq(lines.line13b.value, 570000n, '$5,700.00, Schedule 1-A\'s own $80,000 AGI fixture')
            assertEq(
                lines.line13b.sources.length, lines.line11b.sources.length,
                'cites the SAME sources as line11b (AGI) -- the only fact Schedule 1-A\'s wiring reads',
            )
            assertEq(
                lines.line14.value,
                lines.line12e.value + lines.line13a.value + lines.line13b.value,
                'line14 automatically sums the new line13b value -- no further wiring needed',
            )
        },
        // Task 2 has landed: `seniorAndOtherScheduleOneADeductions` is a
        // MODELED kind now (`fjs/return/scope`'s `modeledKinds`), so
        // `classifyScope` no longer refuses a return declaring it —
        // rewritten IN PLACE from this task's own original "still refuses"
        // assertion (the mechanical adaptation this file's own
        // `retirementAndSocialSecurityBeforeTheScopeReclassificationLands`
        // section, above, already narrates for the identical situation one
        // reclassification earlier). Declaring it through the FULL
        // `form1040Report(...)` entry point now computes a real,
        // non-placeholder line13b — the property Task 3's own end-to-end
        // proof (below) also covers at a different AGI, so this leaf keeps
        // the narrower, faster check: the scope guard specifically stops
        // refusing, at the exact fixture Task 1's own leaf above pinned.
        declaringSeniorAndOtherScheduleOneADeductionsNowComputesThroughTheFullReport: () => {
            const w2Form = w2Document('sha256-t4b-w2-80k')('80000.00')
            const outcome = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'taxableInterest', 'seniorAndOtherScheduleOneADeductions'],
            }))([w2Form])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the kind to compute now', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(
                lineRuled(outcome.lines)('1040 line 13b').value, 570000n,
                '$5,700.00, Schedule 1-A\'s own $80,000 AGI fixture',
            )
        },
        // THE CONTROL for the leaf above: the same declaration minus the
        // still-unmodeled kind computes end to end.
        controlTheSameDeclarationWithoutSeniorAndOtherScheduleOneADeductionsComputes: () => {
            const outcome = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
            }))([])([])([])([])([])([])([])([]))
            assertEq(outcome.kind, 'ok', ['dropping the unmodeled kind must compute', outcome])
        },
    },
    // Plan 13-10 Task 1 — Schedule 8812 wired into lines 19/28, with
    // `childTaxCreditOrOtherDependents`/`additionalChildTaxCredit` still
    // refused at `classifyScope` (inert until Task 2's own reclassification,
    // mirroring `retirementAndSocialSecurityBeforeTheScopeReclassificationLands`'s
    // and `seniorDeductionBeforeTheScopeReclassificationLands`'s own shape,
    // one reclassification earlier).
    dependentsBeforeTheScopeReclassificationLands: {
        // Two qualifying children (age 10/12, valid SSN), $60,000.00 AGI --
        // well under the $200,000.00 single phase-out threshold -- and
        // ample tax liability ($5,075.00, computed independently below) so
        // line13 never binds: line 19 = 2 x $2,200.00 = $4,400.00. Calls
        // `computedLines` (`form1040IncomeLines` then
        // `form1040TaxAndPaymentLines`) DIRECTLY, bypassing `classifyScope`,
        // since the kind is not declared here at all.
        twoQualifyingChildrenComputeARealNonZeroLineNineteen: () => {
            const w2Form = w2Document('sha256-t10-w2-60k')('60000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                dependentCount: 2,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 12, livedWithTaxpayer: true },
                ],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])
            const { tax } = computedLines(inputs)
            assertEq(tax.line19.value, 440000n, '$4,400.00 -- two qualifying children x $2,200.00')
            assert(tax.line19.value > 0n, ['expected a real, non-zero line 19', tax.line19.value])
            // Cross-checked a SECOND way, independent of `form1040TaxAndPaymentLines`'s
            // own wiring: the SAME facts fed straight to `form8812(...)`
            // (never through the report's own call site) must reach the
            // identical line14.
            const crossCheck = form8812(taxParams2025)({
                status: 'single',
                agiCents: 6000000n,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 12, livedWithTaxpayer: true },
                ],
                line18Cents: tax.line18.value,
                earnedIncomeCents: 0n,
                nontaxableCombatPayCents: 0n,
            })
            assert(crossCheck.kind === 'ok', ['expected the cross-check to compute', crossCheck])
            if (crossCheck.kind === 'ok') {
                assertEq(crossCheck.line14, 440000n, 'independent form8812(...) call must reach the SAME figure')
            }
        },
        // 3+ qualifying children makes Part II-B reachable (`fjs/form8812`'s
        // own docstring) -- the whole report refuses, naming "Part II-B",
        // rather than silently computing a wrong ACTC. Calls
        // `form1040IncomeLines`/`form1040TaxAndPaymentLines` directly the
        // same way, so the leaf localizes to THIS guard, not the scope guard.
        threeQualifyingChildrenRefusesTheWholeReportNamingPartTwoB: () => {
            const w2Form = w2Document('sha256-t10-w2-3kids')('60000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                dependentCount: 3,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 5, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 8, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 11, livedWithTaxpayer: true },
                ],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])
            const income = expectIncomeOk(form1040IncomeLines(taxParams2025)(inputs))
            const outcome = form1040TaxAndPaymentLines(taxParams2025)(inputs)(income)
            assert(
                outcome.kind === 'error',
                ['expected the whole report to refuse, never a silently-wrong ACTC', outcome],
            )
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('Part II-B'),
                ['expected the refusal to name Part II-B', outcome.message],
            )
            assertEq(
                outcome.unmodeled.length, 0,
                ['unmodeled must be empty -- this is not a fjs/return/scope kind refusal', outcome.unmodeled],
            )
        },
        // Task 2 has landed: `childTaxCreditOrOtherDependents` is a MODELED
        // kind now (`fjs/return/scope`'s `modeledKinds`), so `classifyScope`
        // no longer refuses a return declaring it -- rewritten IN PLACE from
        // this task's own original "still refuses" assertion, the same
        // mechanical adaptation this file's own
        // `declaringSeniorAndOtherScheduleOneADeductionsNowComputesThroughTheFullReport`
        // leaf already narrates for an earlier reclassification, one wave
        // over.
        declaringChildTaxCreditOrOtherDependentsNowComputesThroughTheFullReport: () => {
            const w2Form = w2Document('sha256-t10-w2-inert')('60000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                dependentCount: 2,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 12, livedWithTaxpayer: true },
                ],
                declaredKinds: ['wages', 'taxableInterest', 'childTaxCreditOrOtherDependents'],
            }
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the kind to compute now', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(
                lineRuled(outcome.lines)('1040 line 19').value, 440000n,
                '$4,400.00 -- two qualifying children x $2,200.00, same fixture Task 1\'s own leaf pinned',
            )
        },
        // THE CONTROL for the leaf above: the same declaration minus the
        // still-unmodeled kind computes end to end.
        controlTheSameDeclarationWithoutChildTaxCreditOrOtherDependentsComputes: () => {
            const w2Form = w2Document('sha256-t10-w2-inert-control')('60000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                dependentCount: 2,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 12, livedWithTaxpayer: true },
                ],
            }
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([]))
            assertEq(outcome.kind, 'ok', ['dropping the unmodeled kind must compute', outcome])
        },
    },
    // Plan 13-02 Task 3 — Slice 1's own vertical cut, end to end: a real
    // 65+ single filer with a real SSA-1099 and two 1099-Rs computes a REAL,
    // non-placeholder line 6b and a REAL AGI (line 11b) through the FULL
    // `form1040Report(...)` entry point — the point at which this plan's
    // whole objective ("a return with retirement and Social Security income
    // actually computes AGI correctly") is either true or it is not.
    //
    // The fixture lands taxable Social Security in the 85% tier (worksheet
    // line 11 > 0) AND carries nonzero tax-exempt interest — 13-RESEARCH.md
    // §2's criterion-2 case, reused here at the WHOLE-REPORT level rather
    // than fed straight to `socialSecurityBenefitsWorksheet(...)` the way
    // `fjs/tax/ssb`'s own proof does it. Every cents figure below is
    // HAND-COMPUTED from the worksheet's own printed arithmetic
    // (13-RESEARCH.md §2), independently of this file's own code, and
    // cross-checked against a SEPARATE, direct
    // `socialSecurityBenefitsWorksheet(...)` call fed the SAME facts —
    // mirroring
    // `mixedDividendsComputeRealLinesThreeAThreeBSevenAAndANonZeroLineSixteen`'s
    // own `qdcgt` cross-check, one worksheet over.
    wave1RetirementAndSocialSecurity: {
        endToEndSixtyFivePlusReturnComputesARealAgiFromRetirementAndSocialSecurityIncome: () => {
            const w2Form = w2Document('sha256-w1-w2')('20000.00')
            const interestForm = interestDocument('sha256-w1-int')({
                box1InterestIncome: '500.00',
                box8TaxExemptInterest: '3000.00',
            })
            const iraForm = retirementDocument('sha256-w1-r-ira')({
                box1GrossDistribution: '8000.00',
                box2aTaxableAmount: '8000.00',
                box7bIraSepSimple: true,
            })
            const pensionForm = retirementDocument('sha256-w1-r-pension')({
                box1GrossDistribution: '12000.00',
                box2aTaxableAmount: '12000.00',
            })
            const ssaForm = socialSecurityDocument('sha256-w1-ssa')('30000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: [
                    'wages', 'socialSecurityBenefits', 'iraDistributions',
                    'pensionsAndAnnuities', 'federalTaxWithheldOnOther1099',
                ],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([interestForm])([])([])(
                [iraForm, pensionForm])([ssaForm])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the 65+ retirement/SS return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            // Hand-computed from the worksheet's own printed arithmetic
            // (13-RESEARCH.md §2): line1=$30,000.00, line2=$15,000.00,
            // line3=$40,500.00 (1z $20,000.00 + 2b $500.00 + 4b $8,000.00 +
            // 5b $12,000.00), line4=$3,000.00 (the tax-exempt-interest
            // add-back), line5=$58,500.00, line6=$0.00 (no Schedule 1
            // adjustments), line7=$58,500.00, line8=$25,000.00 (single base
            // amount), line9=$33,500.00, line10=$9,000.00 (single second
            // threshold), line11=$24,500.00 (> 0 — the 85% tier),
            // line12=$9,000.00, line13=$4,500.00, line14=$4,500.00 (smaller
            // of line2/line13), line15=$20,825.00 (85% of line11),
            // line16=$25,325.00, line17=$25,500.00 (85% of line1),
            // line18=$25,325.00 (smaller of line16/line17) -> 1040 line 6b.
            const line6a = lineRuled(outcome.lines)('1040 line 6a').value
            const line6b = lineRuled(outcome.lines)('1040 line 6b').value
            assertEq(line6a, 3000000n, '$30,000.00 total SSA-1099 box 5')
            assertEq(line6b, 2532500n, '$25,325.00, hand-computed from the worksheet\'s own arithmetic')
            assert(line6b > 0n, ['expected a real, non-zero taxable Social Security amount', line6b])

            // AGI = 1z ($20,000.00) + 2b ($500.00) + 4b ($8,000.00) + 5b
            // ($12,000.00) + 6b ($25,325.00) - line 10 ($0.00, no
            // adjustments) = $65,825.00. Hand-computed independently of the
            // sources above (added freshly here, never copied from them or
            // from `outcome` itself).
            const line11b = lineRuled(outcome.lines)('1040 line 11b').value
            assertEq(line11b, 6582500n, '$65,825.00 AGI, hand-computed')
            assert(line11b > 0n, ['expected a real, non-zero AGI', line11b])

            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own wiring: the SAME facts fed straight to
            // `socialSecurityBenefitsWorksheet(...)` (never to
            // `form1040IncomeLines`, so this does not merely re-run the code
            // under test) must reach the identical line 18.
            const crossCheck = socialSecurityBenefitsWorksheet(taxParams2025)({
                status: 'single',
                mfsLivedWithSpouseAtAnyTimeInYear: false,
                totalSsaAndRrbBox5Cents: 3000000n,
                otherIncomeLine3Cents: 4050000n,
                taxExemptInterestCents: 300000n,
                scheduleOneAdjustmentsTotalCents: 0n,
            }).line18
            assertEq(crossCheck, 2532500n, 'independent socialSecurityBenefitsWorksheet(...) call must reach the SAME figure')
            assertEq(line6b, crossCheck, 'the wiring must feed the SAME facts an independent worksheet call would')
        },
        // THE SAME kind of profile, with `iraDeductionDeclared: true` added:
        // the return refuses BEFORE the worksheet ever runs, naming
        // Pub. 590-A — Decision 3.3/5.1's circularity refusal, proven at the
        // whole-report level rather than only through `form1040IncomeLines`
        // directly (`retirementAndSocialSecurityBeforeTheScopeReclassificationLands`'s
        // own `iraDeductionDeclaredRefusesNamingPub590ABeforeTheWorksheetRuns`
        // leaf, above, is the narrower, isolated version of this same fact).
        sameProfileWithIraDeductionDeclaredRefusesNamingPub590A: () => {
            const iraForm = retirementDocument('sha256-w1b-r-ira')({
                box1GrossDistribution: '8000.00',
                box2aTaxableAmount: '8000.00',
                box7bIraSepSimple: true,
            })
            const ssaForm = socialSecurityDocument('sha256-w1b-ssa')('30000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                iraDeductionDeclared: true,
                declaredKinds: [
                    'wages', 'socialSecurityBenefits', 'iraDistributions',
                ],
            }
            const inputs = inputsOf(storedProfile(profile))([])([])([])([])([iraForm])([ssaForm])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'error', ['expected the IRA-deduction refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('Pub. 590-A'),
                ['expected the refusal to name Pub. 590-A', outcome.message],
            )
            assertEq(outcome.unmodeled.length, 0, ['expected an EMPTY unmodeled list', outcome.unmodeled])
        },
    },
    // Plan 13-04 Task 3 — Slice 2's own vertical cut, end to end (closes
    // TAX-09): a real 65+ single filer's line13b is a REAL, non-placeholder
    // Schedule 1-A figure, and line15 (taxable income) is correspondingly
    // LOWER than it would be with line13b = $0 — through the FULL
    // `form1040Report(...)` entry point, the point at which "a 65+ TY2025
    // return stops being structurally wrong" (13-CONTEXT.md's own Slice 2
    // acceptance test) is either true or it is not.
    wave2SeniorDeduction: {
        // AGI $100,000.00 — $25,000.00 into the $75,000.00 single phase-out
        // start — hand-computed against Schedule 1-A's own printed
        // arithmetic (13-RESEARCH.md §1): line33 = $25,000.00, line34 = 6%
        // of $25,000.00 = $1,500.00 (cent-exact, never $1,000-stepped),
        // line35 = $6,000.00 - $1,500.00 = $4,500.00, line37 = line38 =
        // $4,500.00 (no tips/overtime/car-loan declared).
        endToEndSixtyFivePlusReturnComputesARealNonZeroLineThirteenB: () => {
            const w2Form = w2Document('sha256-w2-t04-100k')('100000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the 65+ senior-deduction return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }

            const line11b = lineRuled(outcome.lines)('1040 line 11b').value
            assertEq(line11b, 10000000n, '$100,000.00 AGI -- wages alone')

            const line13b = lineRuled(outcome.lines)('1040 line 13b').value
            assertEq(line13b, 450000n, '$4,500.00, hand-computed from Schedule 1-A\'s own printed arithmetic')
            assert(line13b > 0n, ['expected a real, non-zero senior deduction', line13b])

            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own wiring: the SAME AGI fed straight to `scheduleOneA(...)`
            // (never to `form1040IncomeLines`, so this does not merely
            // re-run the code under test) must reach the identical line38.
            const crossCheck = scheduleOneA(taxParams2025)({
                status: 'single',
                agiCents: 10000000n,
                taxpayerHasValidSsnAndBornBefore1961Jan2: true,
                spouseHasValidSsnAndBornBefore1961Jan2: false,
                profile: storedProfile(profile),
            }).partVI.line38
            assertEq(crossCheck, 450000n, 'independent scheduleOneA(...) call must reach the SAME figure')
            assertEq(line13b, crossCheck, 'the wiring must feed the SAME facts an independent scheduleOneA call would')

            // line15 (taxable income) is CORRESPONDINGLY LOWER than it would
            // be with line13b = $0 -- $17,750.00 standard deduction (single,
            // one age box, the $2,000 unmarried increment) + $0.00 would
            // leave line15 = $100,000.00 - $17,750.00 = $82,250.00 WITHOUT
            // the senior deduction. WITH it, line14 = $17,750.00 +
            // $4,500.00 = $22,250.00, so line15 = $100,000.00 - $22,250.00
            // = $77,750.00 -- exactly $4,500.00 lower, the senior
            // deduction's own amount.
            const line15 = lineRuled(outcome.lines)('1040 line 15').value
            assertEq(line15, 7775000n, '$77,750.00 taxable income, WITH the $4,500.00 senior deduction')
            const standardDeductionAlone = lineRuled(outcome.lines)('1040 line 12e').value
            assertEq(standardDeductionAlone, 1775000n, '$17,750.00, single with one age box')
            const line15WithoutSeniorDeduction = line11b - standardDeductionAlone
            assertEq(
                line15, line15WithoutSeniorDeduction - line13b,
                'line15 must be exactly line13b LOWER than it would be with line13b = $0',
            )
        },
        // THE CONTROL: an MFS 65+ filer, otherwise IDENTICAL, computes
        // line13b = $0 -- Decision 5.4/Pitfall 3's short-circuit, proven at
        // the WHOLE-REPORT level through `form1040Report`, not merely
        // inside `fjs/schedule/1a`'s own standalone proof.
        mfsSixtyFivePlusReturnComputesLineThirteenBAtZero: () => {
            const w2Form = w2Document('sha256-w2-t04-mfs-100k')('100000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                filingStatus: 'marriedFilingSeparately',
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the MFS return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            const line13b = lineRuled(outcome.lines)('1040 line 13b').value
            assertEq(
                line13b, 0n,
                'MFS gets $0 UNCONDITIONALLY, even at $100,000 AGI, well past the phase-out start',
            )
        },
    },
    // Wave 3 (TAX-13, Slice 3, Plan 13-07): a return that itemizes computes
    // line 12e for real, through the full `form1040Report` entry point —
    // both directions, per criterion 3. THE SECOND leaf is the load-bearing
    // one: itemizing does NOT automatically win merely because it exceeds
    // the BASE $15,750/$31,500 figure.
    wave3Itemizing: {
        // Itemizing WINS: a single filer, no age/blindness boxes, itemized
        // total $20,000.00 -- above the $15,750.00 base standard deduction.
        // Hand-totaled independently of `scheduleA`'s own arithmetic:
        // $8,000.00 SALT (under the $40,000 cap, well under the $500,000
        // phase-down threshold) + $9,000.00 mortgage interest (trusted at
        // face value, no Pub. 936 limitation on Schedule A's own printed
        // face) + $3,000.00 cash charity = $20,000.00.
        itemizingWinsComputesLineTwelveEAsTheItemizedTotal: () => {
            const w2Form = w2Document('sha256-w2-t07-itemizing-wins')('90000.00')
            const itemizedForm = itemizedDeductionsDocument('sha256-itemized-t07-wins')([
                { lineTag: 'saltIncomeTax', amount: '8000.00' },
                { lineTag: 'mortgageInterest1098', amount: '9000.00' },
                { lineTag: 'charitableCash', amount: '3000.00' },
            ])
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: ['wages', 'itemizedDeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the itemizing return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }

            const line11b = lineRuled(outcome.lines)('1040 line 11b').value
            assertEq(line11b, 9000000n, '$90,000.00 AGI -- wages alone')

            const line12e = lineRuled(outcome.lines)('1040 line 12e')
            assertEq(line12e.value, 2000000n, '$20,000.00 itemized total, exceeding the $15,750.00 standard')
            // Decision 2.4: line 12e cites what was COMPARED, not only what
            // won -- the itemized-deductions document's own hash is among
            // line 12e's sources even though it is also the WINNER here.
            assert(
                line12e.sources.some(source => source.documentHash === 'sha256-itemized-t07-wins'),
                ['expected line 12e to cite the itemized-deductions document', line12e.sources],
            )

            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own wiring: the SAME entries fed straight to `scheduleA(...)`
            // (never to `form1040IncomeLines`) must reach the identical
            // line 17 grand total.
            const crossCheck = expectScheduleAOk(scheduleA(taxParams2025)({
                status: 'single',
                agiCents: line11b,
                itemizedEntries: [
                    { documentHash: 'sha256-itemized-t07-wins', value: { lineTag: 'saltIncomeTax', provider: 'Some Provider', amount: '8000.00' } },
                    { documentHash: 'sha256-itemized-t07-wins', value: { lineTag: 'mortgageInterest1098', provider: 'Some Provider', amount: '9000.00' } },
                    { documentHash: 'sha256-itemized-t07-wins', value: { lineTag: 'charitableCash', provider: 'Some Provider', amount: '3000.00' } },
                ],
                medicalExpenseEntries: [],
                profile: storedProfile(profile),
            })).line17
            assertEq(crossCheck, 2000000n, 'independent scheduleA(...) call must reach the SAME grand total')

            // line15 (taxable income) REFLECTS the itemized figure, not the
            // $15,750.00 base standard deduction: line13a/line13b are both
            // $0 for this profile (no age boxes, no tips/overtime/car-loan
            // declared), so line14 = line12e = $20,000.00, and line15 =
            // $90,000.00 - $20,000.00 = $70,000.00 -- $4,250.00 LOWER than
            // the $74,250.00 it would be with the $15,750.00 standard
            // deduction instead.
            const line15 = lineRuled(outcome.lines)('1040 line 15').value
            assertEq(line15, 7000000n, '$70,000.00 taxable income, WITH the $20,000.00 itemized total')
        },
        // THE LOAD-BEARING CASE (criterion 3): a single filer with BOTH
        // age/blindness boxes checked has a REAL standard deduction of
        // $19,750.00 ($15,750.00 + two $2,000.00 increments) -- NOT the
        // bare chart minimum. $18,000.00 of itemized deductions exceeds
        // that $15,750.00 BASE figure and STILL LOSES, because the
        // comparison is against THIS filer's own $19,750.00, never the
        // base. An engine where itemizing automatically wins above the
        // base figure would ship $18,000.00 here; this one ships
        // $19,750.00.
        standardStillWinsAboveTheBaseThresholdTheLoadBearingCase: () => {
            const w2Form = w2Document('sha256-w2-t07-standard-still-wins')('90000.00')
            const itemizedForm = itemizedDeductionsDocument('sha256-itemized-t07-loses')([
                { lineTag: 'saltIncomeTax', amount: '8000.00' },
                { lineTag: 'mortgageInterest1098', amount: '7000.00' },
                { lineTag: 'charitableCash', amount: '3000.00' },
            ])
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                taxpayerIsBlind: true,
                declaredKinds: ['wages', 'itemizedDeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the standard-still-wins return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }

            const line12e = lineRuled(outcome.lines)('1040 line 12e')
            assertEq(
                line12e.value, 1975000n,
                '$19,750.00 (two age/blindness boxes) -- NOT the $18,000.00 itemized total, ' +
                'and NOT the base $15,750.00: itemizing does not automatically win above the base figure',
            )
            assert(line12e.value !== 1800000n, ['line 12e must not equal the losing itemized figure', line12e.value])
            // Even though the STANDARD deduction won, line 12e still cites
            // the itemized-deductions document -- Decision 2.4: what was
            // COMPARED, not only what won.
            assert(
                line12e.sources.some(source => source.documentHash === 'sha256-itemized-t07-loses'),
                ['expected line 12e to cite the itemized-deductions document even though it lost', line12e.sources],
            )

            // Cross-checked independently: the itemized total itself really
            // is $18,000.00 -- ABOVE the base $15,750.00 -- so the property
            // under test is genuinely exercised, not a fixture that merely
            // looks like it is.
            const crossCheck = expectScheduleAOk(scheduleA(taxParams2025)({
                status: 'single',
                agiCents: 9000000n,
                itemizedEntries: [
                    { documentHash: 'sha256-itemized-t07-loses', value: { lineTag: 'saltIncomeTax', provider: 'Some Provider', amount: '8000.00' } },
                    { documentHash: 'sha256-itemized-t07-loses', value: { lineTag: 'mortgageInterest1098', provider: 'Some Provider', amount: '7000.00' } },
                    { documentHash: 'sha256-itemized-t07-loses', value: { lineTag: 'charitableCash', provider: 'Some Provider', amount: '3000.00' } },
                ],
                medicalExpenseEntries: [],
                profile: storedProfile(profile),
            })).line17
            assertEq(crossCheck, 1800000n, '$18,000.00, independently confirmed above the BASE $15,750.00')
            assert(crossCheck > 1575000n, ['expected the itemized total to exceed the base standard deduction', crossCheck])
        },
    },
    // Plan 13-10 Task 3 — Slice 4's own vertical cut, end to end (closes
    // TAX-12 and, with it, Phase 13's fourth vertical slice): a return with
    // declared dependents computes a real CTC/ODC (line 19) AND a real ACTC
    // (line 28) through the FULL `form1040Report(...)` entry point — never
    // through a direct `form8812(...)` call.
    wave4Dependents: {
        // ONE qualifying child (age 10, valid SSN, $2,200.00 CTC) and ONE
        // other dependent (age 20, $500.00 ODC) — the CTC/ODC SPLIT proven
        // end to end, not merely classified in isolation. $20,000.00 wages
        // (AGI), single, no age/blindness boxes: standard deduction
        // $15,750.00, taxable income $4,250.00, tax (Tax Table) $428.00 --
        // hand-computed and independently cross-checked below via
        // `baseTaxForAmount(...)`.
        //
        // Line 19 (1040): line8 = $2,200.00 + $500.00 = $2,700.00, well under
        // the $200,000.00 single phase-out (line10/11 = $0.00), so
        // line12 = $2,700.00 -- but line13 (Credit Limit Worksheet A) is the
        // return's OWN $428.00 tax liability, smaller than line12, so
        // line14 = $428.00: the CTC/ODC is CAPPED by tax liability, a real,
        // non-zero, non-degenerate figure.
        //
        // Line 28 (1040): line16a = line12 - line14 = $2,700.00 - $428.00 =
        // $2,272.00; line16b = 1 qualifying child x $1,700.00 = $1,700.00
        // (the ACTC cap counts ONLY qualifying children, never other
        // dependents); line17 = min(line16a, line16b) = $1,700.00.
        // `earnedIncome: '20000.00'` (declared on the profile, matching
        // wages) exercises line19/20's own arithmetic: line19 = $20,000.00 -
        // $2,500.00 = $17,500.00; line20 = 15% of that = $2,625.00.
        // line27 = min(line17, line20) = $1,700.00 -> 1040 line 28.
        oneQualifyingChildAndOneOtherDependentComputeRealCtcOdcAndActc: () => {
            const w2Form = w2Document('sha256-t10-wave4-w2')('20000.00')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                dependentCount: 2,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'mother', ssnValidForEmployment: true, ageAtYearEnd: 20, livedWithTaxpayer: true },
                ],
                earnedIncome: '20000.00',
                declaredKinds: ['wages', 'childTaxCreditOrOtherDependents', 'additionalChildTaxCredit'],
            }
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the dependents return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }

            const line11b = lineRuled(outcome.lines)('1040 line 11b').value
            assertEq(line11b, 2000000n, '$20,000.00 AGI -- wages alone')

            const line19 = lineRuled(outcome.lines)('1040 line 19')
            assertEq(line19.value, 42800n, '$428.00 -- CTC/ODC capped by this return\'s own tax liability')
            assert(line19.value > 0n, ['expected a real, non-zero line 19', line19.value])

            const line28 = lineRuled(outcome.lines)('1040 line 28')
            assertEq(line28.value, 170000n, '$1,700.00 -- ACTC, capped by ONE qualifying child\'s $1,700.00')
            assert(line28.value > 0n, ['expected a real, non-zero line 28', line28.value])

            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own wiring: the SAME facts fed straight to `form8812(...)`
            // (never through the report's own call site) must reach the
            // identical line14/line27.
            const line18 = lineRuled(outcome.lines)('1040 line 18').value
            const crossCheck = form8812(taxParams2025)({
                status: 'single',
                agiCents: 2000000n,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                    { relationship: 'mother', ssnValidForEmployment: true, ageAtYearEnd: 20, livedWithTaxpayer: true },
                ],
                line18Cents: line18,
                earnedIncomeCents: 2000000n,
                nontaxableCombatPayCents: 0n,
            })
            assert(crossCheck.kind === 'ok', ['expected the cross-check to compute', crossCheck])
            if (crossCheck.kind === 'ok') {
                assertEq(crossCheck.line14, line19.value, 'independent form8812(...) call must reach the SAME line19 figure')
                assertEq(crossCheck.line27, line28.value, 'independent form8812(...) call must reach the SAME line28 figure')
            }

            // Independent cross-check of the tax liability itself, never
            // assumed: the SAME taxable income fed straight to
            // `baseTaxForAmount(...)` (never to `dispatchLine16`) must reach
            // the identical cents this fixture's own hand-computation used.
            const line15 = lineRuled(outcome.lines)('1040 line 15').value
            assertEq(line15, 425000n, '$4,250.00 taxable income -- $20,000.00 less the $15,750.00 standard deduction')
            const taxCrossCheck = baseTaxForAmount(taxParams2025)('single')(line15)
            assertEq(taxCrossCheck.cents, 42800n, 'independent baseTaxForAmount(...) call must reach the SAME $428.00 tax')
        },
        // THE PHASE-OUT CLIFF, at the WHOLE-REPORT level (contrast
        // `fjs/form8812`'s own `steppedCliff` proof, which calls `form8812`
        // directly): a married-filing-jointly filer with ONE qualifying
        // child, AGI exactly $400,000.00 versus $400,000.01 -- one cent
        // over the threshold costs the FULL $50.00 first step immediately,
        // visible on 1040 line 19 itself, not merely inside Schedule 8812's
        // own standalone proof. Tax liability at either AGI (well into six
        // figures of taxable income) is far larger than line12's own
        // $2,200.00/$2,150.00, so line13 never binds and the whole $50.00
        // move is visible on line 19 unobstructed.
        mfjOneCentOverThePhaseOutThresholdCostsTheFullFiftyDollarStepOnLineNineteen: () => {
            const atThreshold = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                filingStatus: 'marriedFilingJointly',
                dependentCount: 1,
                dependents: [
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
                declaredKinds: ['wages', 'childTaxCreditOrOtherDependents', 'additionalChildTaxCredit'],
            }))([w2Document('sha256-t10-wave4-cliff-at')('400000.00')])([])([])([])([])([])([])([]))
            assert(atThreshold.kind === 'ok', ['expected the at-threshold return to compute', atThreshold])
            if (atThreshold.kind !== 'ok') {
                throw ['expected ok', atThreshold]
            }
            assertEq(
                lineRuled(atThreshold.lines)('1040 line 19').value, 220000n,
                '$2,200.00 -- one qualifying child, no phase-out yet at exactly $400,000.00 AGI',
            )

            const overThreshold = form1040Report(taxParams2025)(inputsOf(storedProfile({
                ...singleProfile,
                filingStatus: 'marriedFilingJointly',
                dependentCount: 1,
                dependents: [
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
                declaredKinds: ['wages', 'childTaxCreditOrOtherDependents', 'additionalChildTaxCredit'],
            }))([w2Document('sha256-t10-wave4-cliff-over')('400000.01')])([])([])([])([])([])([])([]))
            assert(overThreshold.kind === 'ok', ['expected the over-threshold return to compute', overThreshold])
            if (overThreshold.kind !== 'ok') {
                throw ['expected ok', overThreshold]
            }
            assertEq(
                lineRuled(overThreshold.lines)('1040 line 19').value, 215000n,
                '$2,150.00 -- $0.01 of excess rounds UP to a full $1,000.00 step, costing $50.00 immediately',
            )

            assertEq(
                lineRuled(atThreshold.lines)('1040 line 19').value - lineRuled(overThreshold.lines)('1040 line 19').value,
                5000n,
                'exactly a $50.00 drop between $400,000.00 and $400,000.01 AGI, visible on 1040 line 19 itself',
            )
        },
    },
    // 12.1-VERIFICATION.md's WARNING, second half: no COMMITTED,
    // regression-tested proof exercised the FULL production chain —
    // `fjs/form8949` → `fjs/schedule/d` → `fjs/tax/line16/sdtw` →
    // `fjs/tax/line16`'s `dispatchLine16` → this file's own
    // `form1040Report(...)` — for a non-degenerate §1250/28%-rate case
    // (dispatcher branch 2a) reaching an `'ok'` outcome. `12.1-04-SUMMARY.md`
    // says as much itself: Task 2's acceptance criterion for this exact
    // scenario was verified only via an UNCOMMITTED, throwaway script, and
    // the phase's own verifier reproduced it again the same way (its own
    // Truth #2) rather than trusting that claim. Neither run left anything
    // behind to catch a future regression — e.g. a Phase 13 refactor of this
    // file's `dispatchLine16` call site silently breaking this path.
    endToEndSectionOneTwoFiftyGainReachesLineSixteenThroughTheFullChain: {
        // MFJ, wages $90,000.00, a $40,000.00 long-term gain from a single
        // 1099-B sale (proceeds $45,000.00 less basis $5,000.00, category D:
        // long-term with basis reported to the IRS), and a 1099-DIV carrying
        // ONLY box 2b — $3,000.00 of unrecaptured section 1250 gain, no box
        // 2a/2d. Schedule D lines 15/16 = $40,000.00 (both gains, from the
        // brokerage sale alone); line 18 = $0 (no box 2d); line 19 =
        // $3,000.00 (box 2b, via its own sub-worksheet, independent of the
        // brokerage sale per `fjs/schedule/d`'s own docstring). That is
        // exactly branch 2a's condition — `filingScheduleD && D15>0 && D16>0
        // && (D18>0 || D19>0)` — with D19 the non-zero term, so
        // `dispatchLine16` MUST select `scheduleDTaxWorksheet`, never
        // `qdcgt` (no qualified dividends are declared here at all, so the
        // 2a-before-2c ordering is not even in tension for this fixture —
        // 2c is not a candidate).
        //
        // AGI = $90,000.00 wages + $40,000.00 Schedule D gain = $130,000.00.
        // Taxable income (1040 line 15) = $130,000.00 - $31,500.00 (2025 MFJ
        // standard deduction) = $98,500.00 — independently confirmed against
        // this same fixture below, never assumed.
        //
        // `717600n` ($7,176.00) is NOT a fresh literal invented here: it is
        // this verifier's own Truth #2 measurement
        // (`12.1-VERIFICATION.md`, "Behavioral Spot-Checks"), independently
        // RE-DERIVED for this commit by running this exact fixture and
        // separately, by feeding the SAME facts straight to `sdtw(...)`
        // below — never assumed, never copied from one side of this leaf to
        // the other.
        nonDegenerateSectionOneTwoFiftyGainComputesThroughFormOneZeroFourZeroReport: () => {
            const dividendForm = dividendDocument('sha256-div-e2e-1250')({
                box2bUnrecapSec1250Gain: '3000.00',
            })
            const brokerageForm = brokerageDocument('sha256-b-e2e-1250')({
                box1dProceeds: '45000.00',
                box1eCostOrOtherBasis: '5000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const profile = {
                ...marriedFilingJointlyProfile,
                declaredKinds: /** @type {readonly Kind[]} */ (
                    ['wages', 'capitalGainsOrLosses', 'unrecaptured1250Gain']),
            }
            const inputs = inputsOf(storedProfile(profile))([
                w2Document('sha256-w2-e2e-1250')('90000.00'),
            ])([])([dividendForm])([brokerageForm])([])([])([])([])

            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the full chain to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            // The method tag, not merely the value — the 2a-before-2c
            // ordering (12.1-CONTEXT.md's own "Specific Ideas" note) is
            // only observable through this tag when the two worksheets
            // could otherwise agree; asserting it is what proves branch 2a,
            // not merely SOME branch, produced the figure below.
            assertEq(outcome.line16Method, 'scheduleDTaxWorksheet', 'branch 2a must select the SDTW, not the QDCGT')

            const taxableIncome = lineRuled(outcome.lines)('1040 line 15').value
            assertEq(taxableIncome, 9850000n, '$98,500.00, independently hand-computed above')
            const line7a = lineRuled(outcome.lines)('1040 line 7a').value
            assertEq(line7a, 4000000n, '$40,000.00, the brokerage sale\'s own gain')
            const line16 = lineRuled(outcome.lines)('1040 line 16').value
            assertEq(line16, 717600n, '$7,176.00 — this verifier\'s own Truth #2 figure, re-derived')

            // Cross-checked a SECOND way, independent of `form1040Report`'s
            // own dispatch: the SAME facts fed straight to `sdtw(...)`
            // (never to `dispatchLine16`, so this does not merely re-run
            // the code under test) must reach the identical cents —
            // mirroring `mixedDividendsComputeRealLinesThreeAThreeBSevenAAndANonZeroLineSixteen`'s
            // own qdcgt cross-check, one worksheet over.
            const crossCheck = sdtw(taxParams2025)({
                status: 'marriedFilingJointly',
                line1Cents: taxableIncome,
                line2Cents: 0n,
                form4952Line4gCents: 0n,
                form4952Line4eCents: 0n,
                scheduleD15Cents: 4000000n,
                scheduleD16Cents: 4000000n,
                scheduleD18Cents: 0n,
                scheduleD19Cents: 300000n,
            }).line47
            assertEq(crossCheck, 717600n, 'independent sdtw(...) call must reach the SAME figure')
            assertEq(line16, crossCheck, 'the wiring must feed the SAME facts an independent sdtw call would')
        },
    },
    // Plan 13-12 Task 2 — the FIRST proof in this codebase combining every
    // one of this phase's five slices in ONE computed return: retirement/
    // Social Security income (Wave 1, TAX-10), the senior deduction
    // (Wave 2, TAX-09), itemizing (Wave 3, TAX-13), dependents (Wave 4,
    // TAX-12), and Schedule 1/2/3's own real per-line citations (this
    // plan, TAX-14) — lines 1a-37, no refusal, through the FULL
    // `form1040Report(...)` entry point. A regression in any ONE wave's
    // wiring cannot hide behind another wave's correct output here:
    // line6b, line13b, line12e and line19 are each asserted against a
    // figure hand-computed INDEPENDENTLY of the other three, and each is
    // separately cross-checked against a direct call to the sub-module
    // that produced it.
    wave5FullProfile: {
        allFiveSlicesComposeInOneReturnComputingLinesOneAThroughThirtySevenWithNoRefusal: () => {
            const w2Form = w2Document('sha256-w5-w2')('40000.00')
            const iraForm = retirementDocument('sha256-w5-r-ira')({
                box1GrossDistribution: '8000.00',
                box2aTaxableAmount: '8000.00',
                box7bIraSepSimple: true,
            })
            const ssaForm = socialSecurityDocument('sha256-w5-ssa')('30000.00')
            const itemizedForm = itemizedDeductionsDocument('sha256-w5-itemized')([
                { lineTag: 'saltIncomeTax', amount: '8000.00' },
                { lineTag: 'mortgageInterest1098', amount: '9000.00' },
                { lineTag: 'charitableCash', amount: '3000.00' },
            ])
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                dependentCount: 1,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
                declaredKinds: [
                    'wages', 'taxableInterest', 'socialSecurityBenefits', 'iraDistributions',
                    'pensionsAndAnnuities', 'federalTaxWithheldOnOther1099',
                    'seniorAndOtherScheduleOneADeductions', 'itemizedDeductions',
                    'childTaxCreditOrOtherDependents', 'additionalChildTaxCredit',
                ],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])(
                [iraForm])([ssaForm])([itemizedForm])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected all five slices to compose without refusal', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }

            // Slice 1 (Wave 1, TAX-10) — 1z ($40,000.00 wages) + 4b
            // ($8,000.00 taxable IRA distribution) feed the SSB
            // worksheet's own arithmetic: line1=$30,000.00,
            // line2=$15,000.00 (50%), line3=$48,000.00 (1z+4b),
            // line5=$63,000.00, line7=$63,000.00 (no Schedule 1
            // adjustments), line9=$38,000.00 (>$25,000.00 single base),
            // line11=$29,000.00 (>$9,000.00 second threshold — the 85%
            // tier), line12=$9,000.00, line13=$4,500.00, line14=$4,500.00
            // (smaller of line2/line13), line15=$24,650.00 (85% of
            // line11), line16=$29,150.00, line17=$25,500.00 (85% of
            // line1), line18=$25,500.00 (smaller of line16/line17) ->
            // 1040 line 6b.
            const line6b = lineRuled(outcome.lines)('1040 line 6b')
            assertEq(line6b.value, 2550000n, '$25,500.00, hand-computed from the worksheet\'s own arithmetic')
            assert(line6b.value > 0n, ['expected a real, non-zero taxable Social Security amount', line6b.value])
            const ssbCrossCheck = socialSecurityBenefitsWorksheet(taxParams2025)({
                status: 'single',
                mfsLivedWithSpouseAtAnyTimeInYear: false,
                totalSsaAndRrbBox5Cents: 3000000n,
                otherIncomeLine3Cents: 4800000n,
                taxExemptInterestCents: 0n,
                scheduleOneAdjustmentsTotalCents: 0n,
            }).line18
            assertEq(ssbCrossCheck, 2550000n, 'independent socialSecurityBenefitsWorksheet(...) call must reach the SAME figure')
            assertEq(line6b.value, ssbCrossCheck, 'the wiring must feed the SAME facts an independent worksheet call would')

            // AGI (1040 line 11b) = 1z ($40,000.00) + 4b ($8,000.00) + 6b
            // ($25,500.00) = $73,500.00 — no Schedule 1 adjustments (line
            // 10 stays $0.00, Slice 5's own boundary).
            const line11b = lineRuled(outcome.lines)('1040 line 11b').value
            assertEq(line11b, 7350000n, '$73,500.00 AGI, hand-computed')

            // Slice 2 (Wave 2, TAX-09) — $73,500.00 AGI is BELOW the
            // $75,000.00 single phase-out threshold, so the senior
            // deduction is the FULL, unreduced base amount: $6,000.00
            // (one qualifying person, age box checked, a valid SSN
            // assumed for a declared filer per this file's own established
            // convention).
            const line13b = lineRuled(outcome.lines)('1040 line 13b')
            assertEq(
                line13b.value, 600000n,
                '$6,000.00, the full unreduced base amount — $73,500.00 AGI is under the $75,000.00 threshold',
            )
            assert(line13b.value > 0n, ['expected a real, non-zero senior deduction', line13b.value])
            const scheduleOneACrossCheck = scheduleOneA(taxParams2025)({
                status: 'single',
                agiCents: 7350000n,
                taxpayerHasValidSsnAndBornBefore1961Jan2: true,
                spouseHasValidSsnAndBornBefore1961Jan2: false,
                profile: storedProfile(profile),
            }).partVI.line38
            assertEq(scheduleOneACrossCheck, 600000n, 'independent scheduleOneA(...) call must reach the SAME figure')
            assertEq(line13b.value, scheduleOneACrossCheck, 'the wiring must feed the SAME facts an independent scheduleOneA call would')

            // Slice 3 (Wave 3, TAX-13) — $8,000.00 SALT + $9,000.00
            // mortgage interest + $3,000.00 cash charity = $20,000.00
            // itemized total, ABOVE this filer's own $17,750.00 standard
            // deduction (single, one age box, the $2,000.00 unmarried
            // increment) — itemizing wins.
            const line12e = lineRuled(outcome.lines)('1040 line 12e')
            assertEq(line12e.value, 2000000n, '$20,000.00 itemized total, exceeding the $17,750.00 standard deduction')
            assert(line12e.value > 0n, ['expected a real, non-zero line 12e', line12e.value])
            const scheduleACrossCheck = expectScheduleAOk(scheduleA(taxParams2025)({
                status: 'single',
                agiCents: 7350000n,
                itemizedEntries: [
                    { documentHash: 'sha256-w5-itemized', value: { lineTag: 'saltIncomeTax', provider: 'Some Provider', amount: '8000.00' } },
                    { documentHash: 'sha256-w5-itemized', value: { lineTag: 'mortgageInterest1098', provider: 'Some Provider', amount: '9000.00' } },
                    { documentHash: 'sha256-w5-itemized', value: { lineTag: 'charitableCash', provider: 'Some Provider', amount: '3000.00' } },
                ],
                medicalExpenseEntries: [],
                profile: storedProfile(profile),
            })).line17
            assertEq(scheduleACrossCheck, 2000000n, 'independent scheduleA(...) call must reach the SAME grand total')

            // line15 (taxable income) = line11b - line14; line14 =
            // line12e ($20,000.00) + line13a ($0.00, no QBI) + line13b
            // ($6,000.00) = $26,000.00; line15 = $73,500.00 - $26,000.00
            // = $47,500.00.
            const line15 = lineRuled(outcome.lines)('1040 line 15').value
            assertEq(line15, 4750000n, '$47,500.00 taxable income')

            // Slice 4 (Wave 4, TAX-12) — ONE qualifying child (age 10,
            // valid SSN), $2,200.00 base CTC, well under the $200,000.00
            // single phase-out and well under this return's own
            // $5,465.00 tax liability (line18), so line19 is the FULL,
            // UNCAPPED $2,200.00.
            const line18 = lineRuled(outcome.lines)('1040 line 18').value
            const line19 = lineRuled(outcome.lines)('1040 line 19')
            assertEq(line19.value, 220000n, '$2,200.00 — the full, uncapped CTC for one qualifying child')
            assert(line19.value > 0n, ['expected a real, non-zero line 19', line19.value])
            const form8812CrossCheck = form8812(taxParams2025)({
                status: 'single',
                agiCents: 7350000n,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
                line18Cents: line18,
                earnedIncomeCents: 0n,
                nontaxableCombatPayCents: 0n,
            })
            assert(form8812CrossCheck.kind === 'ok', ['expected the cross-check to compute', form8812CrossCheck])
            if (form8812CrossCheck.kind === 'ok') {
                assertEq(form8812CrossCheck.line14, line19.value, 'independent form8812(...) call must reach the SAME line19 figure')
            }

            // Slice 5 (this plan, TAX-14) — Schedule 1/2/3 all stay at
            // $0.00 for this profile (their five coarse kinds all remain
            // unmodeled-refused per this plan's own scope), but
            // line8/10/17/20/23/31 now cite the real schedule modules
            // rather than an opaque inline zero (Task 1's own citation-
            // granularity improvement, exercised end to end here).
            assertEq(lineRuled(outcome.lines)('1040 line 8').value, 0n, 'Schedule 1 Part I stays $0.00 — the coarse kind stays refused')
            assertEq(lineRuled(outcome.lines)('1040 line 10').value, 0n, 'Schedule 1 Part II stays $0.00 — the coarse kind stays refused')
            assertEq(lineRuled(outcome.lines)('1040 line 17').value, 0n, 'Schedule 2 Part I stays $0.00 — the coarse kind stays refused')
            assertEq(lineRuled(outcome.lines)('1040 line 20').value, 0n, 'Schedule 3 Part I stays $0.00 — the coarse kind stays refused')
            assertEq(lineRuled(outcome.lines)('1040 line 23').value, 0n, 'Schedule 2 Part II stays $0.00 — the coarse kind stays refused')
            assertEq(lineRuled(outcome.lines)('1040 line 31').value, 0n, 'Schedule 3 Part II stays $0.00 — the coarse kind stays refused')

            // Independent cross-check of the tax liability itself: the
            // SAME taxable income fed straight to `baseTaxForAmount(...)`
            // (never to `dispatchLine16`) must reach the identical cents
            // used above as line18's own input.
            const taxCrossCheck = baseTaxForAmount(taxParams2025)('single')(4750000n)
            assertEq(taxCrossCheck.cents, 546500n, 'independent baseTaxForAmount(...) call must reach the SAME $5,465.00 tax')
            assertEq(line18, 546500n, '$5,465.00 — line16 (tax) + line17 (Schedule 2 Part I, $0.00)')
        },
    },
}
