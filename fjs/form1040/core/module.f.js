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
import { dialect as adjustmentsDialect } from '../../document/adjustments/module.f.js'
import { dialect as oneZeroNineEightEDialect } from '../../document/1098e/module.f.js'
import { qdcgt } from '../../tax/line16/qdcgt/module.f.js'
import { sdtw } from '../../tax/line16/sdtw/module.f.js'
// Imported for the PROOFS only, to cross-check the threaded Part III against an
// independent execution (criterion 4). The production path below reaches Part
// III through `fjs/schedule/2` and `fjs/form6251`, never directly.
import { partThree } from '../../form6251/part3/module.f.js'
import { socialSecurityBenefitsWorksheet } from '../../tax/ssb/module.f.js'
import {
    dialect as returnProfileDialect,
    kindVocabulary,
    validate as validateReturnProfile,
} from '../../return/profile/module.f.js'
import { classifyScope } from '../../return/scope/module.f.js'
import { classifyTripwires } from '../../return/tripwire/module.f.js'
import { deductionChoice } from '../../tax/deduction/module.f.js'
import { individualFilingStatuses, taxParamsByYear } from '../../tax/params/module.f.js'
import { scheduleD } from '../../schedule/d/module.f.js'
import { scheduleOneA } from '../../schedule/1a/module.f.js'
import { scheduleA } from '../../schedule/a/module.f.js'
import {
    passThroughOf,
    scheduleOnePartI,
    scheduleOnePartIIExceptStudentLoanInterest,
    scheduleOnePartII,
    socialSecurityWorksheetAdjustmentsTotal,
} from '../../schedule/1/module.f.js'
import { scheduleTwo } from '../../schedule/2/module.f.js'
import {
    netCapitalGainLine12,
    qualifiedBusinessIncomeDeduction,
    taxableIncomeBeforeQualifiedBusinessIncomeDeduction,
} from '../../form8995/module.f.js'
import { scheduleThree } from '../../schedule/3/module.f.js'
import { form8812 } from '../../form8812/module.f.js'
import { iraTaxableAmount } from '../../form8606/module.f.js'
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
/** @import { Adjustments } from '../../document/adjustments/module.f.js' */
/** @import { OneZeroNineEightE } from '../../document/1098e/module.f.js' */
/** @import { OneZeroNineEightT } from '../../document/1098t/module.f.js' */
/** @import { Credits } from '../../document/credits/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { PriorYearCapitalLoss } from '../../document/prior_year_capital_loss/module.f.js' */
/** @import { Ira } from '../../document/ira/module.f.js' */
/** @import { PriorYearIraBasis } from '../../document/prior_year_ira_basis/module.f.js' */
/** @import { FormThirtyNineTwentyOne } from '../../document/form3921/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { FormThirtyNineTwentyTwo } from '../../document/form3922/module.f.js' */
/** @import { BasisCorrection } from '../../document/basis_correction/module.f.js' */
/** @import { Kind, ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */
/** @import { Line16Method, Line16Preferential } from '../../tax/line16/module.f.js' */
/** @import { NoRegularPreferentialWorksheet } from '../../form6251/module.f.js' */
/** @import { RegularPreferentialWorksheet } from '../../form6251/part3/module.f.js' */
/** @import { RefusableKind } from '../../return/scope/module.f.js' */
/** @import { ScheduleDOutcome } from '../../schedule/d/module.f.js' */
/** @import { SelfEmploymentOutcome } from '../../schedule/se/module.f.js' */
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
 *
 * `tuitionForms`/`creditForms` are Phase 25's own widening (TAX-25/TAX-26):
 * Schedule 3 lines 3 and 4 read `vnd.fjs.1098t` and `vnd.fjs.credits`
 * documents. `tuitionForms` is a list because it genuinely is one — a
 * household with two students in college, or one student who transferred
 * mid-year, holds several 1098-Ts, and each is matched to a claimed student
 * by the STUDENT'S TIN rather than by assuming the filer's
 * (`fjs/document/1098t`'s own header records why). `creditForms` is a list
 * under this typedef's own "one running record per taxpayer per year"
 * convention, exactly like `adjustmentForms`.
 *
 * `adjustmentForms`/`studentLoanInterestForms` are Phase 24's own widening
 * (TAX-23/TAX-24): Schedule 1 Part II lines 11, 13 and 21 read
 * `vnd.fjs.adjustments` and `vnd.fjs.1098e` documents. `adjustmentForms` is a
 * list under this typedef's own "one running record per taxpayer per year"
 * convention, exactly like `itemizedDeductionForms`; `studentLoanInterestForms`
 * is a list because it genuinely is one — a borrower whose loans were sold
 * mid-year receives one 1098-E per servicer.
 *
 * `iraForms`/`priorYearIraBasisForms` are Phase 26's own widening
 * (TAX-28/TAX-29): line 4b reads `vnd.fjs.ira` for the §408(d)(8) qualified
 * charitable distribution election and Form 8606 Part I's asserted inputs, and
 * `vnd.fjs.prior_year_ira_basis` for that form's own line 2. **Both are LISTS,
 * and here that is not merely this typedef's convention** — Form 8606's own
 * header says "if married, file a separate form for each spouse required to
 * file 2025 Form 8606", so a joint return genuinely carries two of each, one
 * per person, and `fjs/form8606` scopes each to the Forms 1099-R bearing the
 * matching `recipientTin`. A flattening to a single optional document, as
 * `capitalLossCarryoverForms` gets below, would be wrong rather than merely
 * lossy.
 *
 * `nonemployeeCompensationForms`/`businessExpenseForms` are Phase 27's own
 * widening (DOC-20/DOC-21/TAX-30): Schedule 1 Part I line 3 reads them through
 * `fjs/schedule/c`, and 1040 line 25b reads `vnd.fjs.1099nec` box 4 directly.
 * `nonemployeeCompensationForms` is a list because it genuinely is one — a
 * freelancer with six clients receives six Forms 1099-NEC, and §6041A obliges
 * each of them to file separately. `businessExpenseForms` is a list for a
 * DIFFERENT reason from every other list here: not this typedef's "one running
 * record per taxpayer per year" convention, but because Schedule C is filed
 * PER BUSINESS and a taxpayer may run two. `fjs/schedule/c` supports one and
 * REFUSES a second by name; the list shape is what lets it see the second one
 * in order to refuse it, which a flattening to a single optional document
 * would silently prevent.
 *
 * `isoExerciseForms`, `employeeStockPurchaseForms` and `basisCorrectionForms`
 * are Phase 29's own widening (DOC-22/DOC-23/TAX-33/TAX-34). All three are
 * LISTS and all three genuinely are: an employee who exercised twice in a year
 * receives two Forms 3921, an employee stock purchase plan issues one Form
 * 3922 per PURCHASE PERIOD (so two a year is the ordinary case on a six-month
 * plan), and a basis correction is per SALE — a taxpayer who sold four
 * mis-basised lots stores four. `fjs/form8949` matches each correction to its
 * Form 1099-B by CAS hash and REFUSES one that matches nothing, which is what
 * makes the list shape safe rather than merely convenient.
 *
 * `partnershipK1Forms`/`sCorporationK1Forms` are Phase 30's own widening
 * (DOC-24/TAX-35): Schedule 1 Part I line 5 reads them through
 * `fjs/schedule/e`, and Schedule SE line 2 reads the partnership half's box 14
 * code A. **Both are LISTS and both genuinely are** — printed Schedule E Part
 * II line 28 is a FOUR-ROW table with a column (b) for "P for partnership, S
 * for S corporation", so a founder with a partnership stake and an
 * S-corporation holding fills two rows of one table. This is the OPPOSITE of
 * `businessExpenseForms`, whose list shape exists so `fjs/schedule/c` can SEE
 * a second business in order to refuse it: `fjs/schedule/e` combines its rows,
 * which is what the printed form asks for, and it is safe to do so because
 * every row that could carry a loss refuses before any total is formed.
 *
 * Two K-1s from the SAME entity refuse, which is the hazard the list shape
 * genuinely introduces — a duplicate transcription, or an original beside its
 * correction, would otherwise report the income twice.
 *
 * `capitalLossCarryoverForms` is Plan 15-05's own widening (TAX-17): a LIST,
 * matching this typedef's own established "one running record per taxpayer
 * per year" convention (see `itemizedDeductionForms`/`medicalExpenseForms`
 * above) even though `vnd.fjs.prior_year_capital_loss` is also a single
 * running record — `form1040IncomeLines` flattens it to Schedule D's own
 * OPTIONAL `priorYearCapitalLossCarryover` field by taking the first entry,
 * `undefined` otherwise, mirroring how the two prior list widenings above
 * are flattened into `scheduleA`.
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
 *   readonly capitalLossCarryoverForms: readonly Stored<PriorYearCapitalLoss>[],
 *   readonly unemploymentForms: readonly Stored<OneZeroNineNineG>[],
 *   readonly nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
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
 *   readonly itemizing: boolean,
 *   readonly scheduleALine7Cents: bigint,
 *   readonly scheduleOneALine37Cents: bigint,
 *   readonly filingScheduleD: boolean,
 *   readonly scheduleD15Cents: bigint,
 *   readonly scheduleD16Cents: bigint,
 *   readonly scheduleD18Cents: bigint,
 *   readonly scheduleD19Cents: bigint,
 *   readonly selfEmployment: SelfEmploymentOutcome,
 *   readonly specifiedPrivateActivityBondInterest: ReportLine,
 * }} Form1040IncomeLines
 */

/**
 * Computes Form 1040 lines 1a through 15 for an in-scope return.
 *
 * Every `1b`-`1i` line is a {@link profileDeclaredZeroLine}: zero only
 * because the corresponding kind was not declared. Had it been declared,
 * `fjs/return/scope` would already have refused the whole report, so
 * "declared but unmodeled" never reaches this function. Lines 3a, 3b and 7a
 * left that group in Plan 12.1-04; lines 4a, 4b, 5a, 5b and 6a in Plan 13-02
 * (Slice 1, TAX-10); lines 8, 10 and 13b as Schedules 1 and 1-A were wired;
 * and **line 13a in Phase 28** (TAX-32), which is the last of them — see the
 * comments above each line's construction below. Line 6b was never a
 * placeholder at all: it is the 18-line Social Security Benefits Worksheet's
 * own output (`fjs/tax/ssb`).
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
        capitalLossCarryoverForms,
        unemploymentForms,
        nonemployeeCompensationForms, businessExpenseForms,
        adjustmentForms, studentLoanInterestForms,
        iraForms, priorYearIraBasisForms,
        employeeStockPurchaseForms, basisCorrectionForms,
        partnershipK1Forms, sCorporationK1Forms,
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
    // TAX-17/Phase 15: `capitalLossCarryoverForms` is a LIST (this file's own
    // established convention — see `Form1040Inputs`'s own docstring),
    // flattened to Schedule D's OPTIONAL single-document field by taking the
    // first entry, `undefined` otherwise — the SAME cardinality-flattening
    // technique already used for `itemizedDeductionForms`/
    // `medicalExpenseForms`. The conditional spread below (never a bare
    // `priorYearCapitalLossCarryover: maybeUndefined`) is required under
    // `exactOptionalPropertyTypes`: a spread carrying `undefined` explicitly
    // assigns the key holding `undefined` rather than omitting it, which
    // `ScheduleDInputs`'s optional field does not admit.
    const priorYearCapitalLossCarryover = capitalLossCarryoverForms[0]
    // TAX-34/Phase 29: a stored basis correction that Schedule D will never
    // run is an assertion the engine would DROP, and `fjs/form8949` refuses
    // every other way that can happen (a correction naming no supplied
    // document, two naming one, one naming a document with no sale). This is
    // the fourth way, and it is the only one visible from here rather than
    // from inside that module: Schedule D runs only for a return that declared
    // `capitalGainsOrLosses`, so a correction on an undeclared return reaches
    // nothing. A document-data-sufficiency refusal, `unmodeled: []`, exactly
    // like the three guards below it.
    const [firstBasisCorrection] = basisCorrectionForms
    if (firstBasisCorrection !== undefined && !filingScheduleD) {
        return {
            kind: 'error',
            message: `basis correction ${firstBasisCorrection.documentHash} names brokerage `
                + `document ${firstBasisCorrection.value.brokerageDocumentHash}, but this return `
                + `does not declare capitalGainsOrLosses, so no Schedule D is computed and the `
                + `correction would reach no Form 8949 row at all. Declare capitalGainsOrLosses `
                + `on the return profile, or remove the correction — refusing rather than `
                + `silently dropping the taxpayer's assertion about their own basis.`,
            unmodeled: [],
        }
    }
    /** @type {ScheduleDOutcome | undefined} */
    const scheduleDOutcome = filingScheduleD
        ? scheduleD({
            status, brokerageForms, dividendForms,
            basisCorrections: basisCorrectionForms,
            employeeStockPurchaseForms,
            ...(priorYearCapitalLossCarryover === undefined ? {} : { priorYearCapitalLossCarryover }),
        })
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
    // Box 9, the §57(a)(5) private-activity slice of box 8, summed here and
    // NOWHERE ELSE. It reaches Form 6251 line 2g through Schedule 2 and has no
    // other reader in the engine.
    //
    // **It must never join a regular-tax line.** Box 9 is a SUBSET of box 8,
    // which line 2a above already sums, so adding it anywhere in Parts I or II
    // would count the same interest twice — and §103(a) excludes every cent of
    // it from gross income regardless, which is why the AMT is the only place
    // it can appear. `proof.privateActivityBonds.lineTwoAIsUnmovedByBoxNine`
    // is the assertion that keeps this true rather than merely intended.
    const specifiedPrivateActivityBondInterest = fromDocuments('Form 6251 line 2g')(
        sumBoxOverDocuments(interestForms)('box9SpecifiedPrivateActivityBondInterest')(
            form => form.box9SpecifiedPrivateActivityBondInterest))
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
    //
    // **Line 4a stays GROSS, and Phase 26 does not touch it.** The printed
    // instruction is explicit for a qualified charitable distribution: "enter
    // the total distribution on line 4a. If the total amount distributed is a
    // QCD, enter -0- on line 4b." The reduction is a TAXABLE-amount reduction,
    // never a gross one, and `lineFourAStaysGrossWhileFourBFalls` is the leaf
    // that says so.
    const line4a = fromDocuments('1040 line 4a')(
        sumBoxOverDocuments(iraRetirementForms)('box1GrossDistribution')(
            form => form.box1GrossDistribution))
    // 4b — the box-2a sum this engine has always taken, THEN handed to
    // `fjs/form8606` (Phase 26, TAX-28/TAX-29) for §408(d)(8)'s QCD exclusion
    // and Form 8606 Part I's pro-rata rule. Passing the already-computed sum
    // in rather than letting that module rebuild it is what makes "a retiree
    // with neither a QCD nor a basis computes exactly what they computed
    // before" a structural identity: with no `vnd.fjs.ira` document,
    // `iraTaxableAmount` returns this very object back.
    const line4bBeforeIraRecords = sumBoxOverDocuments(iraRetirementForms)('box2aTaxableAmount')(
        form => form.box2aTaxableAmount)
    const iraOutcome = iraTaxableAmount(taxParamSet)({
        iraRecords: iraForms,
        priorYearBasisForms: priorYearIraBasisForms,
        iraRetirementForms,
        // ALL Forms 1099-R, not only the IRA ones: a QCD claimed against a
        // 401(k) must be refused BY NAME, which needs the pension document in
        // hand rather than merely absent from the IRA set.
        allRetirementForms: retirementForms,
        // The union of the two line-12d age boxes. `fjs/form8606`'s own
        // docstring carries the whole argument: the box is a NECESSARY
        // condition for having attained 70½ and nowhere near a sufficient
        // one, and the union is the weakest sound form of it, because
        // `vnd.fjs.return_profile` carries no TIN and this file cannot map a
        // recipient TIN to "taxpayer" or "spouse".
        anyFilerBornBeforeJan2_1961: profile.value.taxpayerBornBeforeJan2_1961 === true
            || profile.value.spouseBornBeforeJan2_1961 === true,
        line4bBeforeIraRecords,
    })
    // A document-data-sufficiency refusal from Form 8606 or the QCD election
    // stops the WHOLE return before any later line is built, threaded exactly
    // like the Schedule D absent-basis guard and the Schedule A guard above:
    // `unmodeled: []`, since this names no `fjs/return/scope` kind.
    if (iraOutcome.kind === 'error') {
        return { kind: 'error', message: iraOutcome.message, unmodeled: [] }
    }
    // `[VERIFIED]` Substituting `line4bBeforeIraRecords` here — the mutation
    // that says "the Form 8606/QCD figure is never actually used" — reddens
    // five leaves across this file and `fjs/report/tax_return`. Written first
    // as `iraOutcome.kind === 'ok' ? line4bBeforeIraRecords : iraOutcome.line4b`
    // it does not compile: the guard above narrows `iraOutcome` to its `ok`
    // arm, so the false branch is `never` and `tsc` reports TS2339. Recorded
    // because a mutation that fails to compile measures the compiler
    // (AGENTS.md's first failure mode), and the reshaped one is the result.
    const line4b = fromDocuments('1040 line 4b')(iraOutcome.line4b)
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
    // 8 — Schedule 1 Part I's total additional income (line10). `vnd.fjs.1099g`
    // box 1 attributes unemployment compensation to its own printed line 7
    // (Phase 20); every other Part I line is a `profileDeclaredZeroLine` whose
    // own per-printed-line kind stays in `unmodeledKindRefusals` (Phase 27's
    // split of the coarse `scheduleOneAdditionalIncome`).
    //
    // **Line 3 is Phase 27's** (TAX-30): `fjs/schedule/c`'s own line 31,
    // reaching 1040 line 8 THROUGH Schedule 1's own Part I total, never by a
    // side channel — the identical discipline line 10 already follows for Part
    // II's line 26. Part I can now REFUSE (a Schedule C net loss, a second
    // business, an unmodeled expense line), threaded exactly like the Part II
    // stage-1 guard immediately below and like the Schedule D and Schedule A
    // guards above: `unmodeled: []`, since this names no `fjs/return/scope`
    // kind.
    const scheduleOnePartIResult = scheduleOnePartI({
        profile, unemploymentForms, nonemployeeCompensationForms, businessExpenseForms,
        w2Forms: w2s,
        // **Line 5 is Phase 30's** (TAX-35): `fjs/schedule/e`'s own line 41,
        // reaching 1040 line 8 THROUGH Schedule 1's own Part I total, never by
        // a side channel -- the identical discipline line 3 already follows for
        // Schedule C and line 10 for Part II's line 26.
        partnershipK1Forms, sCorporationK1Forms,
    })
    if (scheduleOnePartIResult.kind === 'error') {
        return { kind: 'error', message: scheduleOnePartIResult.message, unmodeled: [] }
    }
    const line8 = {
        value: scheduleOnePartIResult.line10.value,
        sources: scheduleOnePartIResult.line10.sources,
        rule: '1040 line 8',
    }   // additional income, Schedule 1 Part I total (line10)

    // Schedule 1 Part II, STAGE 1 (Phase 24, TAX-23/TAX-24): every adjustment
    // that does not depend on income — lines 11 (educator expenses) and 13
    // (the HSA deduction) compute here from real documents. Line 21's
    // worksheet needs 1040 line 9, which is not built yet, so it waits for
    // stage 2 below; `fjs/schedule/1`'s own header carries the whole ordering
    // argument and the fixed point it avoids.
    // **Schedule SE runs inside this call** (Phase 28, TAX-31): stage 1 needs
    // its line 13 for Schedule 1 line 15, which is an ADJUSTMENT and
    // therefore reduces AGI. Printed Schedule SE line 2 asks for "Schedule C,
    // line 31" by name, so that is the line handed over rather than Part I's
    // line 3 — the same figure under a different printed number, but a reader
    // diffing this against the page should find the page's own reference.
    // `businessExpenseForms` is here for one field, the proprietor's
    // `recipientTin`, which decides whose Forms W-2 consume the §1402(b)(1)
    // wage base.
    const scheduleOneStageOne = scheduleOnePartIIExceptStudentLoanInterest(taxParamSet)({
        profile, status, adjustmentForms, w2Forms: w2s,
        businessNetProfit: scheduleOnePartIResult.scheduleC.partII.line31,
        businessExpenseForms,
        // ...and printed Schedule SE line 2's OTHER named source, "Schedule
        // K-1 (Form 1065), box 14, code A" -- read off the Schedule E
        // execution Part I already performed, never a second one. It carries
        // the recipient TIN with it, because §1402(b)(1)'s wage base is per
        // PERSON and a partner's Forms W-2 must be told from a spouse's.
        passThrough: passThroughOf(scheduleOnePartIResult.scheduleE),
    })
    // A document-data-sufficiency refusal from Part II — an unrecognized
    // `lineTag`, a following-year educator expense, a spouse entry on a
    // non-joint return, or anything `fjs/form8889` itself refuses — stops the
    // WHOLE return, threaded exactly like the Schedule D absent-basis guard
    // and the Schedule A guard: `unmodeled: []`, since this names no
    // `fjs/return/scope` kind.
    if (scheduleOneStageOne.kind === 'error') {
        return { kind: 'error', message: scheduleOneStageOne.message, unmodeled: [] }
    }

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
    // boundary, not an unhandled throw one module in).
    //
    // **`scheduleOneAdjustmentsTotalCents` is a REAL figure as of Phase 24**,
    // where it was a hardcoded `0n` before. `fjs/tax/ssb`'s own header
    // predicted exactly this — "the field exists and is genuinely read,
    // rather than hardcoded, so a later wave that wires Schedule 1 needs no
    // change to this module at all" — and that is what happened: the change
    // is one argument here. The worksheet's own line 6 asks for Schedule 1
    // "lines 11 through 20, and 23 and 25", which
    // `socialSecurityWorksheetAdjustmentsTotal` states once, in the module
    // that owns those lines. **Line 21 is outside that printed range**, which
    // is precisely what lets this call happen before line 21 is computed —
    // see `fjs/schedule/1`'s own header.
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
        scheduleOneAdjustmentsTotalCents:
            socialSecurityWorksheetAdjustmentsTotal(scheduleOneStageOne),
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
    // Schedule 1 Part II, STAGE 2 (Phase 24, TAX-23): line 21's own printed
    // worksheet, whose line 2 is the 1040 line 9 just computed above, and the
    // line 26 total. Stage 1's already-computed lines are PASSED IN rather
    // than recomputed, so lines 11 and 13 cannot differ between the figure
    // the Social Security worksheet subtracted and the figure line 26 adds.
    const scheduleOnePartIIResult = scheduleOnePartII(taxParamSet)({
        profile, status,
        exceptStudentLoanInterest: scheduleOneStageOne,
        adjustmentForms, studentLoanInterestForms,
        totalIncomeLine: line9,
    })
    if (scheduleOnePartIIResult.kind === 'error') {
        return { kind: 'error', message: scheduleOnePartIIResult.message, unmodeled: [] }
    }
    // 10 — Schedule 1 Part II's own total (line26), read from the schedule
    // itself rather than re-added here: lines 11, 13 and 21 reach 1040 line
    // 10 THROUGH Schedule 1's own Part II total, never by a side channel.
    const line10 = {
        value: scheduleOnePartIIResult.line26.value,
        sources: scheduleOnePartIIResult.line26.sources,
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
        // WR-02 (13-REVIEW.md): the REAL stored W-2/1099-R documents this
        // return already carries -- `scheduleA` observes the same
        // documents `form1040IncomeLines` (this function) does, not
        // fixtures the drift check wrote for itself.
        w2Forms: w2s,
        oneZeroNineNineRForms: retirementForms,
    })
    // CR-01/WR-04/WR-02 (13-REVIEW.md): a document-data-sufficiency refusal
    // from Schedule A (a mutually-exclusive line 5a election, an
    // unrecognized itemized-deductions `lineTag`, or the SALT withholding
    // drift check firing) stops the WHOLE return before any further line is
    // built — threaded exactly like the Schedule D absent-basis guard and
    // the IRA-deduction guard above, one function over: `unmodeled: []`,
    // since this names no `fjs/return/scope` kind.
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
    // WR-03 (13-REVIEW.md): line 13b's VALUE depends on `status` (which
    // threshold applies, and the MFS short-circuit) and on every CHECKED
    // age/blindness box (which of `scheduleOneAResult`'s line36a/line36b is
    // nonzero) -- not merely on AGI. `filingStatusSource`/`twelveDBoxSources`
    // are the SAME `Source`s `line12e` already cites a few dozen lines above
    // (built once, reused here); the annotation mirrors `twelveESources`'s
    // own precedent exactly: a spread of a plain array into an array
    // literal infers a plain array, and the head element is what makes the
    // tuple non-empty.
    /** @type {readonly [Source, ...(readonly Source[])]} */
    const thirteenBSources = [filingStatusSource, ...twelveDBoxSources, ...line11b.sources]
    const line13b = {
        value: scheduleOneAResult.partVI.line38,
        sources: thirteenBSources,
        rule: '1040 line 13b',
    }
    // 13a — the §199A qualified business income deduction (Phase 28,
    // TAX-32), through `fjs/form8995`.
    //
    // **It is computed AFTER line 13b, which is not the printed order**, and
    // that is the whole ordering point Form 8995 turns on. Printed line 11 of
    // that form is "taxable income BEFORE qualified business income
    // deduction", and on the 2025 face 1040 line 14 adds 12, 13a AND 13b — so
    // the figure Form 8995 measures its 20% limitation against is
    // `line 11 − line 12 − line 13b`, which cannot be computed until 13b
    // exists. Computing 13a first, as the printed line numbers suggest, would
    // leave the senior deduction inside the limitation base and overstate the
    // deduction for a senior with a business.
    //
    // There is no circularity here, only that order: line 11 of Form 8995
    // excludes the very deduction being computed, by its own wording.
    const [firstBusinessRecord] = businessExpenseForms
    const qbiOutcome = qualifiedBusinessIncomeDeduction(taxParamSet)({
        status,
        // Schedule C line 31, and the SAME Schedule SE execution line 10
        // already deducted half of -- §199A(c)(1) reduces qualified business
        // income by that half, so the two uses are one figure read twice
        // rather than two figures that could drift.
        netProfitCents: scheduleOnePartIResult.scheduleC.partII.line31.value,
        deductibleHalfOfSelfEmploymentTaxCents: scheduleOneStageOne.selfEmployment.lines.line13,
        assertedPriorYearLossCarryforward: firstBusinessRecord === undefined
            ? undefined
            : firstBusinessRecord.value.priorYearQualifiedBusinessLossCarryforward,
        taxableIncomeBeforeQbiCents: taxableIncomeBeforeQualifiedBusinessIncomeDeduction({
            adjustedGrossIncomeCents: line11b.value,
            deductionCents: line12e.value,
            additionalDeductionsCents: line13b.value,
        }),
        // Form 8995 line 12's own definition, which is the Qualified
        // Dividends and Capital Gain Tax Worksheet's lines 2 and 3 written a
        // second time -- `formEightNineNineFivesNetCapitalGainIsTheWorksheets\
        // Own` is the leaf that COMPARES the two, here where both are in
        // scope.
        netCapitalGainCents: netCapitalGainLine12({
            qualifiedDividendsCents: line3a.value,
            filingScheduleD,
            scheduleD15Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line15,
            scheduleD16Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line16,
            line7aCents: line7a.value,
        }),
    })
    // An unstated prior-year carryforward, or a return above §199A(e)(2)'s
    // threshold, stops the WHOLE report -- threaded exactly like the Schedule
    // D, Schedule A and Schedule C guards above: `unmodeled: []`, since
    // neither names an `fjs/return/scope` kind.
    if (qbiOutcome.kind === 'error') {
        return { kind: 'error', message: qbiOutcome.message, unmodeled: [] }
    }
    // A return with no business filed keeps the documented zero it has always
    // carried, citing the profile alone -- `scheduleC.filed` is the field
    // that tells a break-even business apart from no business at all, and
    // this is the second reader it has ever had.
    const line13a = scheduleOnePartIResult.scheduleC.filed
        ? {
            value: qbiOutcome.form.line15,
            // Every fact the deduction reads: the business documents behind
            // the net profit and the deductible half, the AGI, and the
            // filing-status/12d-box/itemized sources behind line 12e and line
            // 13b that decide the limitation base.
            sources: unionSources([
                scheduleOnePartIResult.scheduleC.partII.line31,
                line11b, line12e, line13b, line3a, line7a,
            ]),
            rule: '1040 line 13a (qualified business income deduction, Form 8995 line 15)',
        }
        : declaredZero('1040 line 13a')
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
        // Three facts Form 6251 needs that no printed 1040 line carries, and
        // which only this function can see (Phase 29, TAX-33).
        //
        // `itemizing` and `scheduleALine7Cents` decide Form 6251 line 2a: an
        // itemizing return adds back Schedule A line 7's TAXES, and a
        // non-itemizing one adds back the whole standard deduction. Both come
        // off the ONE `deductionChoice`/`scheduleA` execution line 12e already
        // performed, so the AMT cannot disagree with the regular tax about
        // which deduction won.
        //
        // `scheduleOneALine37Cents` is Schedule 1-A line **37**, the senior
        // deduction alone — NOT `partVI.line38`, the total that feeds 1040
        // line 13b, which is what Form 6251 line 1a would read if this were
        // copied from the line above it. The two are EQUAL today because this
        // engine models only Parts I, V and VI of that schedule; the day Parts
        // II/III/IV compute, tips and overtime deductions must stay OUT of
        // alternative minimum taxable income and the senior deduction must go
        // back into it, which is exactly what reading line 37 does.
        itemizing: deductionChoiceResult.chosen === 'itemized',
        scheduleALine7Cents: scheduleAResult.line7,
        scheduleOneALine37Cents: scheduleOneAResult.partV.line37,
        filingScheduleD,
        scheduleD15Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line15,
        scheduleD16Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line16,
        scheduleD18Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line18,
        scheduleD19Cents: scheduleDOk === undefined ? 0n : scheduleDOk.line19,
        // The ONE Schedule SE execution, carried through to
        // `form1040TaxAndPaymentLines` so Schedule 2 line 4 and Form 8959
        // Part II read the same form this function's line 10 already
        // deducted half of. A dispatcher INPUT, never a printed line -- the
        // same category as the four `scheduleD*Cents` fields above it.
        selfEmployment: scheduleOneStageOne.selfEmployment,
        // 1099-INT box 9, for Form 6251 line 2g. A dispatcher INPUT and NOT a
        // printed 1040 line -- §103(a) keeps every cent of it out of gross
        // income, so no line of Parts I or II may carry it. Same category as
        // `selfEmployment` and the four `scheduleD*Cents` fields above.
        specifiedPrivateActivityBondInterest,
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
 *   readonly unmodeled: readonly RefusableKind[],
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
 * `childTaxCreditOrOtherDependents` (line 19) or any of Schedule 3 Part I's
 * seven per-line kinds (line 20) is refused whole. So line 21
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
    const {
        profile, w2s, interestForms, dividendForms, brokerageForms, retirementForms,
        unemploymentForms, nonemployeeCompensationForms, isoExerciseForms,
    } = inputs
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
    /**
     * The four regular-tax worksheet lines Form 6251 Part III reads, off
     * whichever worksheet `dispatchLine16` actually ran.
     *
     * `'none'` passes straight through: Part III's own no-worksheet fallbacks
     * are an untranscribed printed rule, and `fjs/form6251` refuses by name on
     * it rather than substituting a zero into a preferential band. That arm is
     * reachable — `fjs/tax/line16`'s level-1 "taxable income is zero or less"
     * gate returns before any worksheet is selected.
     * @type {(preferential: Line16Preferential) => RegularPreferentialWorksheet | NoRegularPreferentialWorksheet}
     */
    const regularPreferentialWorksheetOf = preferential => {
        switch (preferential.kind) {
            // QDCGT line 4 is qualified dividends plus net capital gain; line 5
            // is the ordinary remainder of taxable income.
            case 'qdcgt': return {
                kind: 'qdcgt',
                qdcgtLine4Cents: preferential.worksheet.line4,
                qdcgtLine5Cents: preferential.worksheet.line5,
            }
            // The Schedule D Tax Worksheet's lines 10 (the whole preferential
            // slice), 13 (that slice less unrecaptured §1250 and 28%-rate
            // gain), 14 (the ordinary remainder) and 21. Lines 14 and 21 are
            // DIFFERENT figures and Part III reads them at different lines,
            // which is why both travel — see `fjs/form6251/part3`'s line 27.
            case 'scheduleDTaxWorksheet': return {
                kind: 'scheduleDTaxWorksheet',
                sdtwLine10Cents: preferential.worksheet.line10,
                sdtwLine13Cents: preferential.worksheet.line13,
                sdtwLine14Cents: preferential.worksheet.line14,
                sdtwLine21Cents: preferential.worksheet.line21,
            }
            default: return { kind: 'none' }
        }
    }
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
    // 17/23/25c — Schedule 2 (`fjs/schedule/2`, Plan 13-11/13-12, TAX-14):
    // Part I's total tax (line3) feeds 1040 line 17, Part II's total other
    // taxes (line21) feeds 1040 line 23 — ONE `scheduleTwo(...)` call,
    // mirroring Schedule 1's own single-call precedent above.
    //
    // Since Phase 23 (TAX-20/TAX-21) that call also computes Schedule 2 line
    // 11 (Form 8959, the Additional Medicare Tax) and line 12 (Form 8960, the
    // net investment income tax), so line 23 is a REAL figure for a filer
    // above either statute's threshold, and Form 8959 Part V's line 24 joins
    // 1040 line 25c below — off THIS result, never a second, independently
    // stale execution. The other twelve Schedule 2 kinds stay in
    // `unmodeledKindRefusals`, so every other line of the schedule is still
    // `0n` for any profile this engine can compute.
    //
    // The two W-2 boxes Form 8959 reads have no 1040 line of their own, so
    // they are summed HERE, where the documents are, exactly like line 25a's
    // box 2 — DOC-11's absent-is-absent rule applied once rather than a
    // second time inside the schedule. Box 5 is UNCAPPED (box 3 stops at the
    // Social Security wage base), which is why it and not box 3 is what
    // §3101(b)(2) taxes.
    const medicareWages = fromDocuments('Form 8959 line 1 (Form W-2 box 5)')(
        sumBoxOverDocuments(w2s)('box5MedicareWagesAndTips')(
            w2 => w2.box5MedicareWagesAndTips))
    const medicareTaxWithheld = fromDocuments('Form 8959 line 19 (Form W-2 box 6)')(
        sumBoxOverDocuments(w2s)('box6MedicareTaxWithheld')(
            w2 => w2.box6MedicareTaxWithheld))
    const scheduleTwoOutcome = scheduleTwo(taxParamSet)({
        profile,
        status,
        medicareWages,
        medicareTaxWithheld,
        // Form 8960's three investment incomes, read off the 1040 lines that
        // already carry them -- line 2b and NOT line 2a, because §103(a)
        // keeps tax-exempt interest out of gross income and so out of
        // §1411(c)(1)(A)(i)'s reach. `fjs/form8960`'s own docstring lists
        // every exclusion with the provision behind it.
        taxableInterest: income.line2b,
        ordinaryDividends: income.line3b,
        netCapitalGainOrLoss: income.line7a,
        adjustedGrossIncome: income.line11b,
        // The ONE Schedule SE execution `form1040IncomeLines` already
        // performed, for Schedule 2 line 4 and Form 8959 Part II line 8.
        // Threaded rather than recomputed: its line 13 has ALREADY reduced
        // `income.line11b` above, so a second execution here would be pricing
        // a return the first one changed.
        selfEmployment: income.selfEmployment,
        // Form 6251 line 2g. Summed once at line 2a's site off the SAME
        // `form1040IncomeLines` execution, never re-read here.
        specifiedPrivateActivityBondInterestCents: income.specifiedPrivateActivityBondInterest.value,
        // Phase 29 (TAX-33): everything Form 6251 reads. The AMT recomputes
        // taxable income from scratch, so it needs the deduction total, the
        // deduction's COMPOSITION (which of Schedule A line 7 and line 12e
        // feeds line 2a), Schedule 1-A line 37, and the regular tax it is
        // measured against — all off the SAME `form1040IncomeLines` execution
        // that produced 1040 lines 14 and 15, so the parallel system cannot
        // disagree with the regular one about the inputs they share.
        qualifiedDividends: income.line3a,
        totalDeductions: income.line14,
        regularTax: line16,
        itemizing: income.itemizing,
        scheduleALine7Cents: income.scheduleALine7Cents,
        scheduleOneALine37Cents: income.scheduleOneALine37Cents,
        standardDeductionCents: income.line12e.value,
        isoExerciseForms,
        // §56(b)(3)'s same-year-disposition rule: `fjs/form6251` cannot tell
        // whether the shares sold were the shares exercised, so a stored Form
        // 3921 alongside ANY reported sale refuses. Asked of `box1dProceeds`
        // rather than of the presence of a Form 1099-B, and asked WITHOUT
        // regard to whether Schedule D is being filed — an undeclared sale is
        // still a sale, and the ambiguity it creates does not go away because
        // the return failed to declare it.
        aStoredNineteenNineBReportsASale:
            brokerageForms.some(form => form.value.box1dProceeds !== undefined),
        filingScheduleD: income.filingScheduleD,
        scheduleD15Cents: income.scheduleD15Cents,
        scheduleD16Cents: income.scheduleD16Cents,
        // TAX-33, Form 6251 Part III. Line 14 is Schedule D line 19, the
        // unrecaptured §1250 gain Part III's 25% band prices.
        scheduleD19Cents: income.scheduleD19Cents,
        // ...and the four lines Part III reads off whichever preferential
        // worksheet the REGULAR tax completed, taken from the ONE
        // `dispatchLine16` execution above rather than from a second one.
        //
        // The mapping is here, in the adapter between the two, and it names the
        // SOURCE lines only: `fjs/form6251/part3` owns Part III's numbering and
        // `fjs/tax/line16` owns the worksheets, so neither has to hold the
        // other's line map. Which Part III line reads which of these four is
        // written once, at the printed line that reads it.
        regularPreferentialWorksheet: regularPreferentialWorksheetOf(
            line16Outcome.preferential),
    })
    // Schedule 2 can REFUSE as of Phase 29, and all three of its refusals are
    // Form 6251's: the same-year incentive stock option disposition, a Form
    // 3921 missing a box, and Form 6251 Part III when the upper bound does not
    // settle the AMT at zero. Each is a document-data-sufficiency refusal, so
    // `unmodeled: []` — the same threading `scheduleThreeOutcome` and the
    // Schedule D/A/C guards already use.
    if (scheduleTwoOutcome.kind === 'error') {
        return { kind: 'error', message: scheduleTwoOutcome.message, unmodeled: [] }
    }
    const scheduleTwoResult = scheduleTwoOutcome
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
    //
    // **`scheduleThree(...)` runs FIRST, and the order is a rule rather than
    // a preference.** Schedule 8812's own Credit Limit Worksheet A line 2
    // subtracts Schedule 3 lines 1, 2, 3, 4, 6d, 6e, 6f, 6l and 6m from the
    // tax before the child tax credit sees it — §26's ordering of the
    // nonrefundable personal credits. Until Phase 25 that line was a
    // documented `0n` inside `fjs/form8812` and the two calls could go in
    // either order; lines 3 and 4 are real now, so they cannot.
    const scheduleThreeOutcome = scheduleThree(taxParamSet)({
        profile,
        status,
        agiCents: income.line11b.value,
        line18Cents: line18.value,
        w2Forms: w2s,
        creditForms: inputs.creditForms,
        tuitionForms: inputs.tuitionForms,
        // §25B(d)(2)'s testing period, for the ONE year of it this engine can
        // observe: a stored Form 1099-R reporting a distribution. The other
        // three years of the window are unobservable and `fjs/form8880`
        // refuses on the taxpayer's own assertion instead — see its docstring.
        aStored1099RProvesADistribution: retirementForms.some(
            form => form.value.box1GrossDistribution !== undefined),
    })
    if (scheduleThreeOutcome.kind === 'error') {
        return { kind: 'error', message: scheduleThreeOutcome.message, unmodeled: [] }
    }
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
        // Credit Limit Worksheet A line 2: Schedule 3 lines 3 and 4, off the
        // SAME execution that produced them. The other ten summands the
        // printed worksheet lists are refused `fjs/return/scope` kinds and
        // therefore documented zeros.
        scheduleThreeCreditsCents:
            scheduleThreeOutcome.line3.value + scheduleThreeOutcome.line4.value,
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
    // WR-03 (13-REVIEW.md): lines 19/28 are PRIMARILY determined by the
    // profile's own `dependents` array (ages and SSN-validity, which drive
    // the CTC-vs-ODC counts) -- not merely by AGI. Cited here so an auditor
    // inspecting either line's sources after a dependent's age changes the
    // computed credit sees the array was consulted, mirroring `line12e`'s
    // own precedent of citing every fact a comparison actually reads.
    /** @type {Source} */
    const dependentsSource = {
        documentHash: profile.documentHash,
        boxPath: 'dependents',
        value: JSON.stringify(profile.value.dependents ?? []),
    }
    /** @type {readonly [Source, ...(readonly Source[])]} */
    const nineteenSources = [...unionSources([income.line11b]), dependentsSource]
    const line19 = {
        value: form8812Outcome.line14,
        sources: nineteenSources,
        rule: '1040 line 19',
    }
    // 20/29/31 — Schedule 3 (`fjs/schedule/3`, Plan 13-11/13-12, TAX-14;
    // TAX-25/TAX-26 since Phase 25): Part I's total nonrefundable credits
    // (line8) feeds 1040 line 20, Part II's total other payments/refundable
    // credits (line15) feeds 1040 line 31, and Form 8863 Part I's own line 8
    // feeds 1040 line 29 DIRECTLY, never through this schedule — all from
    // the ONE `scheduleThree(...)` call made above, before Schedule 8812.
    //
    // Ten of Schedule 3's twelve per-line kinds stay in
    // `unmodeledKindRefusals`, so every line but 3 and 4 is `0n` for any
    // profile this engine can compute.
    const line20 = {
        value: scheduleThreeOutcome.line8.value,
        sources: scheduleThreeOutcome.line8.sources,
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
                addBoxSums(
                    sumBoxOverDocuments(dividendForms)('box4FederalIncomeTaxWithheld')(
                        form => form.box4FederalIncomeTaxWithheld))(
                    sumBoxOverDocuments(brokerageForms)('box4FederalIncomeTaxWithheld')(
                        form => form.box4FederalIncomeTaxWithheld)))(
                addBoxSums(
                    sumBoxOverDocuments(unemploymentForms)('box4FederalIncomeTaxWithheld')(
                        form => form.box4FederalIncomeTaxWithheld))(
                    // Phase 27 (DOC-20). §3406 backup withholding on a
                    // 1099-NEC reaches line 25b exactly as the 1099-G's own
                    // box 4 does (Phase 20's precedent, followed rather than
                    // re-argued) — it is 1099-family withholding, and
                    // `federalTaxWithheldOnOther1099`'s remedy already names
                    // that family. Omitting it would overstate the balance due
                    // by money the payer has already sent the IRS.
                    sumBoxOverDocuments(nonemployeeCompensationForms)('box4FederalIncomeTaxWithheld')(
                        form => form.box4FederalIncomeTaxWithheld)))))
    // 25c — Form 8959 Part V line 24, the Additional Medicare Tax an employer
    // already withheld, off the SAME `scheduleTwoResult` line 11 came from.
    //
    // The printed form says so directly: line 24's own caption is "Total
    // Additional Medicare Tax withholding ... Also include this amount with
    // federal income tax withholding on Form 1040, 1040-SR, or 1040-NR, line
    // 25c." Omitting it would be a SILENT OVERSTATEMENT of exactly the size
    // of the tax line 11 just added, for the commonest high-wage case there
    // is: a single filer with one employer above $200,000 has already had
    // the whole 0.9% withheld, and a return that charged the tax without
    // crediting the withholding would tell them they owe $900 they do not.
    //
    // `federalTaxWithheldOnOtherForms` (the kind that used to make this line
    // a declared zero) is still REFUSED, so nothing else can reach line 25c;
    // a profile declaring it is refused whole before this function runs. The
    // profile-declared-zero fallback therefore still applies whenever Form
    // 8959 withheld nothing, which `documentLine` handles by construction --
    // `medicareTaxWithheld`'s own sources are what it cites, and they are
    // the profile's when no W-2 carried box 6.
    const line25c = {
        value: scheduleTwoResult.form8959.line24,
        sources: unionSources([medicareTaxWithheld, medicareWages]),
        // Just `'1040 line 25c'`, the way every other 1040 line in this file
        // is ruled -- NOT "(Form 8959 line 24)". Two reasons, and the second
        // is a proof:
        //
        // - The convention. Lines 19 and 28 do not name Schedule 8812, lines
        //   17 and 23 do not name Schedule 2, line 12e does not name Schedule
        //   A. A 1040 line is named by its 1040 line number; line 16 is the
        //   sole exception, and it names a METHOD rather than a form. What
        //   the amount came from is carried by `sources`, which cite the two
        //   W-2 boxes a reader can actually go and look at.
        // - Phase 22's `controlTheSameReturnBelowTheThresholdComputesSilently`
        //   asserts that a return BELOW the threshold mentions Form 8959
        //   nowhere in any line's rule, and that leaf caught the first draft
        //   of this line, which did. The property is worth keeping: an
        //   ordinary wage earner's return should be byte-identical to what it
        //   was before this phase, and a rule string is part of the report.
        rule: '1040 line 25c',
    }
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
    // Same `dependentsSource` line 19 cites above -- line 28 (the ACTC) is
    // driven by the SAME `dependents` array (line16b's qualifying-child
    // count), from the SAME `form8812Outcome`.
    /** @type {readonly [Source, ...(readonly Source[])]} */
    const twentyEightSources = [...unionSources([income.line11b, line18]), dependentsSource]
    const line28 = {
        value: form8812Outcome.line27,
        sources: twentyEightSources,
        rule: '1040 line 28',
    }
    // 29 — the REFUNDABLE American Opportunity Credit: Form 8863 line 8, off
    // the SAME `scheduleThreeOutcome` lines 20 and 31 came from. It reaches
    // this line DIRECTLY rather than through Schedule 3, because the printed
    // Form 8863 sends it here; only its nonrefundable remainder (line 9,
    // through line 19) goes to Schedule 3 line 3. One form, two destinations
    // — see `fjs/schedule/3`'s own docstring.
    //
    // Ruled just `'1040 line 29'`, per this file's own convention that a 1040
    // line is named by its 1040 line number and what the amount came from is
    // carried by `sources` — the same decision line 25c records at length.
    const line29 = {
        value: scheduleThreeOutcome.form8863.line8,
        sources: scheduleThreeOutcome.line3.sources,
        rule: '1040 line 29',
    }
    const line30 = declaredZero('1040 line 30')   // refundable adoption credit
    // 31 — Schedule 3 Part II's own total (line15), from the SAME
    // `scheduleThreeOutcome` lines 20 and 29 came from — never a second,
    // independently stale `scheduleThree(...)` call.
    const line31 = {
        value: scheduleThreeOutcome.line15.value,
        sources: scheduleThreeOutcome.line15.sources,
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
 * 2. **Classify the SUPPLIED DOCUMENTS against what they prove must have been
 *    declared** (TAX-19, Phase 22) — also before any line is computed, and
 *    also refusing through `fjs/return/scope`'s single constructor. This is
 *    the complementary guard `fjs/return/tripwire` owns, and it exists because
 *    step 1 alone is silent in exactly the case a taxpayer cannot help
 *    themselves with: a $300,000 W-2 box 5 owes Additional Medicare Tax
 *    whether or not the filer has heard of Form 8959, and a declaration-driven
 *    guard has nothing to compare against when the declaration was never made.
 *    See that module's docstring, and `.planning/PERSONA-COVERAGE.md`'s "The
 *    structural finding", for the whole argument.
 *
 *    **Order within the two guards is deliberate: declared-scope first.** A
 *    return that declares an unmodeled kind AND trips a tripwire refuses
 *    either way, so the choice is only about which sentence the taxpayer
 *    reads — and the one naming what they themselves wrote down is the one
 *    they can act on first. It also keeps every pre-existing refusal message
 *    byte-identical to what it was before this phase.
 * 3. Compute lines 1a-37. Line 16's own refusing arm comes back out as the
 *    whole report's outcome by the same rule.
 * 4. Apply the taxpayer's whole-dollar election ONCE, over the whole line
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
    const declaredKinds = declaredKindsOf(profile)
    const scope = classifyScope(declaredKinds)
    if (scope.kind === 'error') {
        return { kind: 'error', message: scope.message, unmodeled: scope.unmodeled }
    }
    // The filing status is narrowed HERE, a third time in this module, rather
    // than threaded down from `form1040IncomeLines`: the tripwire table's
    // Additional Medicare Tax threshold is per-status, and this guard runs
    // strictly BEFORE any line function is called, so there is nothing yet to
    // thread it from. Same narrowing, same `assert`, same unreachable-for-a-
    // validated-profile reasoning as the other two call sites.
    const status = storedFilingStatusNamed(profile.value.filingStatus)
    assert(
        status !== undefined,
        [
            'the return profile carries a filing status this engine has no parameters for',
            profile.value.filingStatus,
        ],
    )
    const tripwires = classifyTripwires(taxParamSet)(status)(declaredKinds)(inputs)
    if (tripwires.kind === 'error') {
        return { kind: 'error', message: tripwires.message, unmodeled: tripwires.unmodeled }
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
 *
 * Phase 28 adds a SEVENTH such field, `selfEmployment` — the one Schedule SE
 * execution, threaded to `form1040TaxAndPaymentLines` for Schedule 2 line 4
 * and Form 8959 Part II. It is excluded here for exactly the reason the six
 * before it are: it is a dispatcher input, not a printed 1040 line, and the
 * `Exclude<>` below is what makes forgetting to say so a compile error rather
 * than a crash on a missing `.sources`.
 * Phase 29 adds THREE more, for the same reason a third time: `itemizing`,
 * `scheduleALine7Cents` and `scheduleOneALine37Cents` are Form 6251 inputs
 * that no printed 1040 line carries. `itemizing` is not even a money value,
 * so the `Exclude<>` below is what turns forgetting one of them into a
 * compile error rather than a crash on a missing `.sources` — which is
 * exactly what it did when this phase first added them.
 * @type {readonly Exclude<keyof Form1040IncomeLines, 'kind' | 'filingScheduleD' | 'scheduleD15Cents' | 'scheduleD16Cents' | 'scheduleD18Cents' | 'scheduleD19Cents' | 'selfEmployment' | 'specifiedPrivateActivityBondInterest' | 'itemizing' | 'scheduleALine7Cents' | 'scheduleOneALine37Cents'>[]}
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
 * A W-2 whose box 1 and box 5 carry the SAME amount — the ordinary case for a
 * wage earner with no pre-tax deferrals, and the shape TAX-19's Additional
 * Medicare Tax tripwire reads. Built ON TOP of {@link w2Document}, like
 * {@link w2WithWithholding}, so the identity fields cannot drift.
 *
 * Box 5 is uncapped (unlike box 3, which stops at the Social Security wage
 * base), which is why it and not box 3 is the box Form 8959 reads.
 *
 * **No fixture in this repository set box 5 before Phase 22** — verified by
 * grep across `fjs/`, the root integration tests and `demo/` — so this helper
 * introduces the box rather than sharing it, and no pre-existing proof can
 * trip the tripwire it feeds.
 * @type {(documentHash: string) => (amount: string) => Stored<W2>}
 */
const w2WithMedicareWages = documentHash => amount => {
    const base = w2Document(documentHash)(amount)
    return { ...base, value: { ...base.value, box5MedicareWagesAndTips: amount } }
}

/**
 * A W-2 whose box 1 and **box 3** carry the same amount — Phase 28's own
 * fixture shape, and a DIFFERENT box from {@link w2WithMedicareWages}'s on
 * purpose.
 *
 * Box 3 is Social Security wages and stops at §1402(b)(1)'s contribution and
 * benefit base; box 5 is Medicare wages and is uncapped. Schedule SE line 8a
 * reads box 3 and Form 8959 line 1 reads box 5, and the two ceilings they
 * share are different ceilings — so a fixture that set both would make it
 * impossible to see which box a wiring actually read. This helper sets box 3
 * ALONE for exactly that reason.
 *
 * `recipientTin` comes from {@link w2Document} and is `'222-22-2222'`, the
 * same TIN {@link businessExpensesDocument} names as the proprietor — which
 * is what makes these wages consume the proprietor's own wage base rather
 * than being refused as somebody else's.
 * @type {(documentHash: string) => (amount: string) => Stored<W2>}
 */
const w2WithSocialSecurityWages = documentHash => amount => {
    const base = w2Document(documentHash)(amount)
    return { ...base, value: { ...base.value, box3SocialSecurityWages: amount } }
}

/**
 * A W-2 carrying box 1 = box 5 AND box 6, the two boxes Form 8959 reads
 * (Phase 23). Built ON TOP of {@link w2WithMedicareWages} so the identity
 * fields and the box-1/box-5 equality cannot drift from it.
 *
 * Box 6 is the ORDINARY 1.45% Medicare tax PLUS whatever Additional Medicare
 * Tax the employer withheld above $200,000 of ITS OWN payroll, in one figure
 * with nothing separating them — which is the whole reason Form 8959 Part V
 * exists. Every caller below hand-computes the box-6 amount from those two
 * rates, so the fixture states what an employer would really have printed
 * rather than what makes a leaf pass.
 *
 * **No fixture in this repository set box 6 before Phase 23** — verified by
 * grep across `fjs/`, the root integration tests and `demo/` — so 1040 line
 * 25c stayed $0.00 for every pre-existing fixture when Form 8959 Part V was
 * wired into it.
 * @type {(documentHash: string) => (amount: string) => (box6MedicareTaxWithheld: string) => Stored<W2>}
 */
const w2WithMedicareBoxes = documentHash => amount => box6MedicareTaxWithheld => {
    const base = w2WithMedicareWages(documentHash)(amount)
    return { ...base, value: { ...base.value, box6MedicareTaxWithheld } }
}

/**
 * The 1099-INT money boxes lines 2a, 2b and 25b read. A box the fixture OMITS
 * is absent in the DOC-11 sense — the point of the absent-box leaf.
 * @typedef {{
 *   readonly box1InterestIncome?: string,
 *   readonly box3UsSavingsBondsAndTreasuryInterest?: string,
 *   readonly box4FederalIncomeTaxWithheld?: string,
 *   readonly box8TaxExemptInterest?: string,
 *   readonly box9SpecifiedPrivateActivityBondInterest?: string,
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
 *
 * `box2bTaxableAmountNotDetermined` is Phase 26's own addition, and it is a
 * FIDELITY field rather than a read one: nothing in this engine branches on
 * it, but it is what a custodian actually checks on a traditional IRA's Form
 * 1099-R, and a QCD fixture that omitted it would be describing a document no
 * payer issues. `fjs/document/1099r`'s own header is where the box's meaning
 * lives.
 * @typedef {{
 *   readonly box1GrossDistribution?: string,
 *   readonly box2aTaxableAmount?: string,
 *   readonly box2bTaxableAmountNotDetermined?: true,
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
 * Assembles the ten input lists into a {@link Form1040Inputs}, defaulting every
 * later widening to an empty array. Widened from
 * three to five curried parameters by Plan 12.1-04 (`dividendForms`,
 * `brokerageForms`), from five to seven by Plan 13-02 (`retirementForms`,
 * `socialSecurityForms`), from seven to nine by Plan 13-07
 * (`itemizedDeductionForms`, `medicalExpenseForms`), and from nine to ten by
 * Plan 15-05 (`capitalLossCarryoverForms`, TAX-17) — `npx tsc --noEmit` is
 * what surfaced every call site below needing the extra empty-array
 * argument, per this plan's own instruction not to enumerate them from
 * memory.
 * @type {(profile: Stored<ReturnProfile>) => (w2s: readonly Stored<W2>[]) => (interestForms: readonly Stored<OneZeroNineNineInt>[]) => (dividendForms: readonly Stored<OneZeroNineNineDiv>[]) => (brokerageForms: readonly Stored<OneZeroNineNineB>[]) => (retirementForms: readonly Stored<OneZeroNineNineR>[]) => (socialSecurityForms: readonly Stored<Ssa1099>[]) => (itemizedDeductionForms: readonly Stored<ItemizedDeductions>[]) => (medicalExpenseForms: readonly Stored<MedicalExpenses>[]) => (capitalLossCarryoverForms: readonly Stored<PriorYearCapitalLoss>[]) => Form1040Inputs}
 */
const inputsOf = profile => w2s => interestForms => dividendForms => brokerageForms =>
    retirementForms => socialSecurityForms => itemizedDeductionForms => medicalExpenseForms =>
        capitalLossCarryoverForms =>
            ({
                profile, w2s, interestForms, dividendForms, brokerageForms,
                retirementForms, socialSecurityForms,
                itemizedDeductionForms, medicalExpenseForms,
                capitalLossCarryoverForms,
                // TEST-HELPER DEFAULT. `unemploymentForms` is REQUIRED on
                // `Form1040Inputs` — a production caller must supply it and
                // `tsc` enforces that. This helper defaults it to empty so the
                // existing proof call sites, none of which concern
                // unemployment, read exactly as they did before. (This comment
                // said "forty" when Phase 20 wrote it; there are 117 today,
                // and the number is dropped rather than re-transcribed —
                // nothing asserts it and nothing can.) Proofs that
                // DO concern it spread this result and override the field.
                unemploymentForms: [],
                nonemployeeCompensationForms: [],
                businessExpenseForms: [],
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
    inputsOf(storedProfile(value))([])([])([])([])([])([])([])([])([])))

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
 * A profile declaring wages plus unemployment compensation and both
 * withholding kinds — the shape of a real Wage-and-Income transcript that
 * carries W-2s and a 1099-G.
 */
const unemploymentProfile = {
    ...marriedFilingJointlyProfile,
    declaredKinds: [
        'wages',
        'unemploymentCompensation',
        'federalTaxWithheldOnW2',
        'federalTaxWithheldOnOther1099',
    ],
}

/** @type {(documentHash: string) => (box1: string) => (box4: string) => Stored<OneZeroNineNineG>} */
const unemploymentDocument = documentHash => box1 => box4 => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.1099g',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'EDD-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1UnemploymentCompensation: box1,
        box4FederalIncomeTaxWithheld: box4,
    },
})

/**
 * A SINGLE filer declaring business income and the 1099-family withholding
 * that comes with it — the startup-founder shape Phase 27 (DOC-20/DOC-21/
 * TAX-30) exists for, at the only scale this engine can put on a 1040 until
 * Phase 28 builds Schedule SE. See `fjs/schedule/c`'s own docstring on
 * §1402(b)(2).
 *
 * It declares NEITHER `wages` NOR `selfEmploymentTax`, and both omissions are
 * deliberate. No wages, so 1040 line 8 is the only thing feeding line 9 and a
 * figure landing there cannot be mistaken for something else. No
 * `selfEmploymentTax`, because declaring it is a scope refusal — that kind is
 * Phase 28's and stays refused, which is exactly what
 * `fjs/return/scope`'s `theTwoPhase28KindsBesideScheduleCStillRefuse` pins.
 */
const selfEmploymentProfile = {
    ...singleProfile,
    declaredKinds: ['businessIncomeOrLoss', 'federalTaxWithheldOnOther1099'],
}

/** @type {(documentHash: string) => (box1: string) => (box4: string) => Stored<OneZeroNineNineNec>} */
const nonemployeeCompensationDocument = documentHash => box1 => box4 => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.1099nec',
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'CLIENT-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1NonemployeeCompensation: box1,
        box4FederalIncomeTaxWithheld: box4,
    },
})

/** @type {(documentHash: string) => (advertisingAmount: string) => Stored<BusinessExpenses>} */
const businessExpensesDocument = documentHash => advertisingAmount => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.business_expenses',
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        // Phase 28 (TAX-32): the §199A(c)(2) carryforward assertion. "0.00"
        // says there was none; ABSENCE refuses, and
        // `aBusinessWithNoCarryforwardAssertionRefuses` is the leaf that
        // exercises the other side by overriding this field.
        priorYearQualifiedBusinessLossCarryforward: '0.00',
        entries: [{
            category: 'advertising',
            datePaid: '2025-03-14',
            description: 'search advertising',
            amount: advertisingAmount,
        }],
    },
})

/**
 * Overrides `inputsOf`'s empty business-document defaults, exactly as
 * {@link withUnemployment} does for the 1099-G — a spread rather than two more
 * curried parameters, so the existing call sites stay untouched.
 * @type {(inputs: Form1040Inputs) => (forms: readonly Stored<OneZeroNineNineNec>[]) => (records: readonly Stored<BusinessExpenses>[]) => Form1040Inputs}
 */
const withBusiness = inputs => forms => records => ({
    ...inputs,
    nonemployeeCompensationForms: forms,
    businessExpenseForms: records,
})

/**
 * Overrides `inputsOf`'s empty `unemploymentForms` default. Written as a
 * spread rather than an eleventh curried parameter so the existing
 * call sites, none of which concern unemployment, stay untouched.
 * @type {(inputs: Form1040Inputs) => (forms: readonly Stored<OneZeroNineNineG>[]) => Form1040Inputs}
 */
const withUnemployment = inputs => forms => ({ ...inputs, unemploymentForms: forms })

/**
 * **A SINGLE filer declaring pass-through income and nothing else** — the
 * startup-founder shape Phase 30 (DOC-24/TAX-35) exists for.
 *
 * It declares NEITHER `wages` NOR `selfEmploymentTax`, and both omissions are
 * deliberate, for the reasons {@link selfEmploymentProfile} gives: no wages, so
 * 1040 line 8 is the only thing feeding line 9 and a figure landing there
 * cannot be mistaken for something else; and `selfEmploymentTax` is a MODELED
 * kind whose declaration this engine does not require, so leaving it out is
 * what makes the pair of fixtures below differ in ONE fact only.
 */
const passThroughProfile = {
    ...singleProfile,
    declaredKinds: ['partnershipAndSCorporationIncome'],
}

/**
 * A general partner's Schedule K-1 (Form 1065): box G ticked general, the §469
 * determination stated, and the SAME amount in box 1 and box 14 code A —
 * which is what a partnership reports for a partner whose whole distributive
 * share is ordinary trade-or-business income.
 * @type {(documentHash: string) => (box1: string) => Stored<K1Partnership>}
 */
const partnershipK1Document = documentHash => box1 => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.k1_1065',
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'PTR-0001',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Ventures LP',
        boxGGeneralPartnerOrLlcMemberManager: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        box1OrdinaryBusinessIncome: box1,
        box14SelfEmploymentEarnings: [{ code: 'A', amount: box1 }],
    },
})

/**
 * An S-corporation shareholder's Schedule K-1 (Form 1120-S). **There is no box
 * G and no box 14 code A**, and there cannot be: an S-corporation
 * shareholder's pro rata share is never net earnings from self-employment
 * (Rev. Rul. 59-221). That absence is the ONE difference between this fixture
 * and {@link partnershipK1Document}, and the pair of leaves below prices it.
 * @type {(documentHash: string) => (box1: string) => Stored<K1SCorporation>}
 */
const sCorporationK1Document = documentHash => box1 => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.k1_1120s',
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'SHR-0001',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Software Inc.',
        materialParticipation: 'materiallyParticipated',
        box1OrdinaryBusinessIncome: box1,
    },
})

/**
 * Overrides `inputsOf`'s empty Schedule K-1 defaults — a spread, exactly as
 * {@link withBusiness} and {@link withUnemployment} are, so no existing call
 * site moves.
 * @type {(inputs: Form1040Inputs) => (partnershipK1Forms: readonly Stored<K1Partnership>[]) => (sCorporationK1Forms: readonly Stored<K1SCorporation>[]) => Form1040Inputs}
 */
const withPassThrough = inputs => partnershipK1Forms => sCorporationK1Forms => ({
    ...inputs, partnershipK1Forms, sCorporationK1Forms,
})

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

/**
 * A SECOND, clearly-labeled-SYNTHETIC `TaxParamSet` — deliberately NEVER
 * added to `taxParamsByYear` — proving "any year with parameters and
 * documents computes" STRUCTURALLY (15-CONTEXT.md's REVISED Area 3: "no
 * TY2024 parameter transcription at all"). Every field except
 * `standardDeduction` is `taxParams2025`'s own, spread verbatim — this
 * fixture exists to show `form1040IncomeLines` genuinely dispatches on
 * whichever `TaxParamSet` argument it is given, not to author a second
 * complete, independently-sourced parameter set. `standardDeduction`
 * doubles every one of TY2025's five printed figures ($15,750.00 ->
 * $31,500.00 single/MFS; $31,500.00 -> $63,000.00 MFJ/QSS; $23,625.00 ->
 * $47,250.00 HoH) and re-labels every one of the five citations `{ kind:
 * 'code' }` with a section string that names itself as synthetic test-only
 * data, never a real IRC section, so nobody downstream mistakes it for a
 * real citation.
 * @type {TaxParamSet}
 */
const syntheticTaxParamSetForGenericityProof = {
    ...taxParams2025,
    standardDeduction: {
        single: {
            amount: '31500.00',
            citation: {
                kind: 'code',
                section: 'SYNTHETIC — Plan 15-05 year-genericity proof, not a real IRC section',
                effectiveDate: '1970-01-01',
            },
        },
        marriedFilingJointly: {
            amount: '63000.00',
            citation: {
                kind: 'code',
                section: 'SYNTHETIC — Plan 15-05 year-genericity proof, not a real IRC section',
                effectiveDate: '1970-01-01',
            },
        },
        marriedFilingSeparately: {
            amount: '31500.00',
            citation: {
                kind: 'code',
                section: 'SYNTHETIC — Plan 15-05 year-genericity proof, not a real IRC section',
                effectiveDate: '1970-01-01',
            },
        },
        headOfHousehold: {
            amount: '47250.00',
            citation: {
                kind: 'code',
                section: 'SYNTHETIC — Plan 15-05 year-genericity proof, not a real IRC section',
                effectiveDate: '1970-01-01',
            },
        },
        qualifyingSurvivingSpouse: {
            amount: '63000.00',
            citation: {
                kind: 'code',
                section: 'SYNTHETIC — Plan 15-05 year-genericity proof, not a real IRC section',
                effectiveDate: '1970-01-01',
            },
        },
    },
}

// ── Phase 24 (TAX-23/TAX-24/DOC-19) fixtures ─────────────────────────────────

/**
 * The non-profit employee `.planning/PERSONA-COVERAGE.md` names: a modestly
 * paid single filer with an educator expense, a health savings account and a
 * student loan. Every one of the three was a hard zero before this phase.
 * @type {ReturnProfile}
 */
const phaseTwentyFourProfile = {
    dialect: returnProfileDialect,
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [
        'wages', 'educatorExpenses', 'healthSavingsAccountDeduction',
        'studentLoanInterestDeduction', 'federalTaxWithheldOnW2',
    ],
}

/**
 * The W-2, carrying box 12 code W beside a much larger code DD amount — so a
 * wiring that read "any box 12 entry" rather than code W alone produces a
 * wildly different HSA limit and is caught end to end, not only in
 * `fjs/schedule/1`'s unit proofs.
 * @type {Stored<W2>}
 */
const phaseTwentyFourW2 = {
    documentHash: 'sha256-p24-w2',
    value: {
        ...w2Document('sha256-p24-w2')('52000.00').value,
        box2FederalIncomeTaxWithheld: '4200.00',
        box12: [{ code: 'DD', amount: '9800.00' }, { code: 'W', amount: '500.00' }],
    },
}

/** @type {Stored<Adjustments>} */
const phaseTwentyFourAdjustments = {
    documentHash: 'sha256-p24-adjustments',
    value: {
        dialect: adjustmentsDialect,
        recipientTin: '222-22-2222',
        taxYear: 2025,
        entries: [
            {
                lineTag: 'educatorExpenses',
                datePaid: '2025-09-02',
                description: 'classroom supplies',
                amount: '300.00',
                individual: 'taxpayer',
            },
            {
                lineTag: 'hsaContribution',
                datePaid: '2025-06-30',
                description: 'HSA contribution',
                amount: '2000.00',
                individual: 'taxpayer',
            },
        ],
        hsaCoverage: [{
            individual: 'taxpayer',
            coverageType: 'selfOnly',
            hadHighDeductibleCoverageAllYear: true,
        }],
    },
}

/** @type {Stored<OneZeroNineEightE>} */
const phaseTwentyFourOneZeroNineEightE = {
    documentHash: 'sha256-p24-1098e',
    value: {
        dialect: oneZeroNineEightEDialect,
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'LOAN-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1StudentLoanInterestReceived: '1842.63',
    },
}

/** @type {Form1040Inputs} */
const phaseTwentyFourInputs = {
    ...inputsOf(storedProfile(phaseTwentyFourProfile))([phaseTwentyFourW2])([])([])([])([])([])([])([])([]),
    adjustmentForms: [phaseTwentyFourAdjustments],
    studentLoanInterestForms: [phaseTwentyFourOneZeroNineEightE],
}


// ── Phase 25's own fixture (TAX-25/TAX-26): a student with a 401(k) ────────
//
// The persona both credits exist for and neither reached before this phase:
// a modest single earner who put money into an employer plan AND paid
// tuition. Until Phase 25 this return computed confidently and OVERSTATED
// the tax by $1,700 of nonrefundable credit, and understated the refund by
// a further $1,000 of refundable credit, with nothing in the report saying
// so.

/** @type {ReturnProfile} */
const phaseTwentyFiveProfile = {
    dialect: returnProfileDialect,
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [
        'wages', 'educationCredits', 'retirementSavingsContributionsCredit',
        'americanOpportunityCredit',
    ],
}

/**
 * The W-2, carrying box 12 code D beside a much larger code DD amount — so a
 * wiring that read "any box 12 entry" rather than the nine deferral codes
 * produces a wildly different saver's credit and is caught end to end, not
 * only in `fjs/schedule/3`'s unit proofs. The identical shape, and the
 * identical reason, as `phaseTwentyFourW2`'s code W beside its code DD.
 * @type {Stored<W2>}
 */
const phaseTwentyFiveW2 = {
    documentHash: 'sha256-p25-w2',
    value: {
        ...w2Document('sha256-p25-w2')('39000.00').value,
        box12: [{ code: 'DD', amount: '9800.00' }, { code: 'D', amount: '2000.00' }],
    },
}

/** The transcribed half: one 1098-T for one student. @type {Stored<OneZeroNineEightT>} */
const phaseTwentyFiveOneZeroNineEightT = {
    documentHash: 'sha256-p25-1098t',
    value: {
        dialect: 'vnd.fjs.1098t',
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        accountNumber: 'STU-0001',
        taxYear: 2025,
        formRevision: '2025',
        box1PaymentsReceivedForQualifiedTuition: '9000.00',
        box8AtLeastHalfTimeStudent: true,
    },
}

/** The asserted half: the election, the Part III answers, the §25B(c)
 * answers, and the §25A(i) age assertion. @type {Stored<Credits>} */
const phaseTwentyFiveCredits = {
    documentHash: 'sha256-p25-credits',
    value: {
        dialect: 'vnd.fjs.credits',
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
}

/** @type {Form1040Inputs} */
const phaseTwentyFiveInputs = {
    ...inputsOf(storedProfile(phaseTwentyFiveProfile))([phaseTwentyFiveW2])([])([])([])([])([])([])([])([]),
    tuitionForms: [phaseTwentyFiveOneZeroNineEightT],
    creditForms: [phaseTwentyFiveCredits],
}

/**
 * The SAME return with one qualifying child — the fixture that makes §26's
 * ordering observable end to end.
 *
 * Nothing else in this repository carries Schedule 3 credits AND a dependent
 * at once, and without such a fixture `form8812`'s new
 * `scheduleThreeCreditsCents` argument could be replaced by `0n` at its call
 * site with the whole suite staying green — a newly-real read that no fixture
 * exercises, which is the defect Phase 24's own verification found and this
 * fixture exists to prevent.
 * @type {Form1040Inputs}
 */
const phaseTwentyFiveWithDependentInputs = {
    ...phaseTwentyFiveInputs,
    profile: storedProfile({
        ...phaseTwentyFiveProfile,
        dependentCount: 1,
        declaredKinds: [
            ...phaseTwentyFiveProfile.declaredKinds,
            'childTaxCreditOrOtherDependents', 'additionalChildTaxCredit',
        ],
        dependents: [{
            relationship: 'daughter',
            ssnValidForEmployment: true,
            ageAtYearEnd: 10,
            livedWithTaxpayer: true,
        }],
        earnedIncome: '39000.00',
    }),
}


/**
 * A return carrying BOTH Social Security benefits and a Schedule 1
 * adjustment — the interaction `fjs/tax/ssb`'s own line 6 exists for, and the
 * one no fixture in this repository covered until a mutation found the gap.
 * @type {Form1040Inputs}
 */
const socialSecurityWithHsaInputs = {
    ...inputsOf(storedProfile({
        ...phaseTwentyFourProfile,
        declaredKinds: [
            'socialSecurityBenefits', 'pensionsAndAnnuities', 'healthSavingsAccountDeduction',
        ],
    }))([])([])([])([])([
        retirementDocument('sha256-p24-pension')({
            box1GrossDistribution: '30000.00',
            box2aTaxableAmount: '30000.00',
        }),
    ])([socialSecurityDocument('sha256-p24-ssa')('30000.00')])([])([])([]),
    adjustmentForms: [{
        documentHash: 'sha256-p24-hsa-only',
        value: {
            dialect: adjustmentsDialect,
            recipientTin: '222-22-2222',
            taxYear: 2025,
            entries: [{
                lineTag: 'hsaContribution',
                datePaid: '2025-06-30',
                description: 'HSA contribution',
                amount: '2000.00',
                individual: 'taxpayer',
            }],
            hsaCoverage: [{
                individual: 'taxpayer',
                coverageType: 'selfOnly',
                hadHighDeductibleCoverageAllYear: true,
            }],
        },
    }],
}

/**
 * A return whose income sits INSIDE §221(b)(2)(B)'s phase-out range, so the
 * worksheet's own line 7 ratio actually bites. The persona fixture above
 * cannot do this job: at $52,000.00 the deduction is unreduced, and a
 * worksheet fed no income at all would produce the identical answer.
 * @type {Form1040Inputs}
 */
const phaseOutInputs = {
    ...inputsOf(storedProfile({
        ...phaseTwentyFourProfile,
        declaredKinds: ['wages', 'studentLoanInterestDeduction'],
    }))([w2Document('sha256-p24-w2-highwage')('95000.00')])([])([])([])([])([])([])([])([]),
    studentLoanInterestForms: [{
        documentHash: 'sha256-p24-1098e-highwage',
        value: {
            ...phaseTwentyFourOneZeroNineEightE.value,
            box1StudentLoanInterestReceived: '2000.00',
        },
    }],
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
            ])([])([])([])([])([])([])([])([])))
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([])))
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
                ])([])([])([])([])([])([])([])))
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
                ])([])([])([])([])([])([])([])))
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
                ])([])([])([])([])([])([])([])))
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
            ])([])([])([])([])([])([])([])))
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
            ])([])([])([])([])([])([])([])([])))
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
        // 12e + 13a + 13b. For a return with NO business, 13a is a
        // profile-declared zero and 13b's own sources are the filing-status
        // and 12d boxes 12e already cites, so the union deduplicates to one
        // declaration box: the filing-status box plus it = 2. Phase 28 left
        // this untouched precisely because `scheduleC.filed` keeps line 13a a
        // declared zero for such a return.
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
            ])([])([])([])([])([])([])([])([])))
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
            ])([])([])([])([])([])([])([])([])))
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
                ])([])([])([])([])([])([])([])([]))
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
                ])([])([])([])([])([])([])([])([]))
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
    // ── Phase 27 (DOC-20/DOC-21/TAX-30): self-employment, end to end ─────────
    selfEmployment: {
        /**
         * **THE END-TO-END CLAIM FOR THE WHOLE PHASE**, and the leaf that
         * answers AGENTS.md's own question — *after wiring anything, ask what
         * fixture actually observes it.* Three of this phase's success
         * criteria are unobservable without it: nothing else runs a 1099-NEC
         * and a business-expenses record through `form1040Report`'s own line
         * assembly, so nothing else could notice Schedule C being wired to a
         * side channel, or to nothing at all.
         *
         * Every figure hand-derived, in printed order:
         *
         *   1099-NEC box 1                                     $350.00
         *   Schedule C line 8   advertising                     $90.00
         *   Schedule C line 28  total expenses                  $90.00
         *   Schedule C line 31  350.00 - 90.00                 $260.00
         *   Schedule 1 line 3   = Schedule C line 31           $260.00
         *   Schedule 1 line 10  Part I total                   $260.00
         *   1040 line 8         = Schedule 1 line 10           $260.00
         *   1040 line 9         total income (nothing else)    $260.00
         *   1040 line 10        adjustments                      $0.00
         *   1040 line 11a       adjusted gross income          $260.00
         *   1040 line 12e       standard deduction, single  $15,750.00
         *   1040 line 15        max(0, 260.00 - 15,750.00)       $0.00
         *   1040 line 16        tax on $0.00                     $0.00
         *   1040 line 24        total tax                        $0.00
         *   1099-NEC box 4                                      $40.00
         *   1040 line 25b       1099-family withholding         $40.00
         *   1040 line 33        total payments                  $40.00
         *   1040 line 34        overpaid  40.00 - 0.00          $40.00
         *
         * $350.00 of receipts rather than a realistic freelance figure
         * because §1402(b)(2)'s $400 floor was where `fjs/schedule/c` started
         * refusing until Phase 28 supplied Schedule SE. **It is kept at
         * $350.00 deliberately now that the ceiling is gone**: at this scale
         * net earnings are $323.22, below the floor, so Schedule SE line 12
         * is $0.00 and this leaf still states the Phase 27 path — 1099-NEC to
         * line 8 to line 25b — with nothing from Phase 28 mixed into it.
         * `aRealisticFounderReturnComputesEndToEnd` below is the same path at
         * a scale where self-employment tax bites, and the two are separate
         * so a failure localises.
         */
        scheduleCReachesLineEightAndTheWithholdingReachesLineTwentyFiveB: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('350.00')('40.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assertEq(income.line8.value, 26000n, '1040 line 8 carries Schedule C\'s $260.00 net profit')
            assertEq(income.line9.value, 26000n, 'total income is the business income alone')
            assertEq(income.line10.value, 0n, 'no adjustments')
            assertEq(income.line11a.value, 26000n, 'AGI = $260.00')
            assertEq(income.line12e.value, 1575000n, 'the single standard deduction, $15,750.00')
            assertEq(income.line15.value, 0n, 'taxable income floors at zero')
            assertEq(tax.line16.value, 0n, 'no tax on zero taxable income')
            assertEq(tax.line24.value, 0n, 'and no other tax')
            assertEq(tax.line25b.value, 4000n, '1040 line 25b carries the $40.00 withheld on the 1099-NEC')
            assertEq(tax.line33.value, 4000n, 'total payments')
            assertEq(tax.line34.value, 4000n, 'overpaid, and refunded in full')
            // Line 8 is Schedule 1's Part I TOTAL, so it unions the sources of
            // every Part I line — the profile's `declaredKinds` behind the
            // still-zero ones AND the two business documents behind line 3.
            // Both must be PRESENT; neither is asserted to be first, since
            // that would be asserting an accident of union order.
            const hashes = income.line8.sources.map(source => source.documentHash)
            assert(
                hashes.includes('sha256-1099nec-01'),
                ['1040 line 8 must cite the Form 1099-NEC behind it', income.line8.sources])
            assert(
                hashes.includes('sha256-business-01'),
                ['1040 line 8 must cite the business expenses record behind it', income.line8.sources])
            // …and line 25b cites the 1099-NEC's own box, not the profile.
            const [withholdingSource] = tax.line25b.sources
            assertEq(withholdingSource.documentHash, 'sha256-1099nec-01')
            assertEq(withholdingSource.boxPath, 'box4FederalIncomeTaxWithheld')
        },
        /**
         * THE CONTROL, and it matters as much as the claim: the SAME profile
         * with NO business documents computes zeros. Without it, the leaf
         * above proves nothing — a line 8 of $260.00 would be evidence only if
         * something could have made it $0.00.
         */
        theSameProfileWithNoBusinessDocumentsComputesZeros: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([])([]))
            assertEq(income.line8.value, 0n, 'no 1099-NEC means no line 8 income')
            assertEq(income.line9.value, 0n)
            assertEq(tax.line25b.value, 0n, 'and no 1099-family withholding')
            const [line8Source] = income.line8.sources
            assertEq(line8Source.boxPath, 'declaredKinds', 'the zero still carries profile provenance')
        },
        /**
         * A Schedule C refusal must stop the WHOLE report, threaded through
         * `form1040IncomeLines`' error arm with `unmodeled: []` — never
         * swallowed into a zero line.
         *
         * **This leaf pinned the §1402(b)(2) refusal until Phase 28**, which
         * deleted it. Re-pointed to the NET LOSS refusal, which is the one a
         * real freelancer now meets first and the one that still cannot be
         * computed: §465's at-risk determination is a multi-year basis
         * history no document here holds. The claim the leaf makes — that a
         * Schedule C refusal reaches the caller unchanged, naming no scope
         * kind — is unchanged; only the refusal it uses to make it is.
         *
         * $50.00 of receipts against $90.00 of advertising is a $40.00 loss.
         */
        aScheduleCRefusalStopsTheWholeReport: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('50.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assert(outcome.kind === 'error', ['a Schedule C refusal must stop the report', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 0, 'a document-data-sufficiency refusal names no scope kind')
            assert(
                outcome.message.includes('line 32') && outcome.message.includes('§465'),
                ['the refusal must reach the caller unchanged', outcome.message])
            assert(
                outcome.message.includes('4000'),
                ['and it must still quote the size of the loss', outcome.message])
        },
        /**
         * **THE PHASE'S END-TO-END CLAIM, and the answer to "can a realistic
         * self-employed return be filed?"** The identical fixture Phase 27
         * could only REFUSE — $48,000.00 of nonemployee compensation less
         * $90.00 of advertising — now computes every line.
         *
         * Every figure hand-derived, in printed order:
         *
         *   1099-NEC box 1                                  $48,000.00
         *   Schedule C line 8   advertising                      $90.00
         *   Schedule C line 31  48,000.00 - 90.00            $47,910.00
         *   Schedule 1 line 3   = Schedule C line 31         $47,910.00
         *   1040 line 8         = Schedule 1 line 10         $47,910.00
         *   1040 line 9         total income                 $47,910.00
         *   Sch SE line 2       = Schedule C line 31         $47,910.00
         *   Sch SE line 4a      4,791,000 x 9235 / 10,000
         *                       = 4,424,488.5 -> half-up     $44,244.89
         *   Sch SE line 9       176,100.00 - 0.00           $176,100.00
         *   Sch SE line 10      4,424,489 x 1240 / 10,000
         *                       = 548,636.636 -> half-up      $5,486.37
         *   Sch SE line 11      4,424,489 x 290 / 10,000
         *                       = 128,310.181 -> half-up      $1,283.10
         *   Sch SE line 12      5,486.37 + 1,283.10           $6,769.47
         *   Sch SE line 13      676,947 x 50 / 100
         *                       = 338,473.5 -> half-up        $3,384.74
         *   Schedule 1 line 15  = Schedule SE line 13         $3,384.74
         *   1040 line 10        adjustments                   $3,384.74
         *   1040 line 11a       47,910.00 - 3,384.74         $44,525.26
         *   Schedule 2 line 4   = Schedule SE line 12         $6,769.47
         *   1040 line 23        other taxes                   $6,769.47
         *
         * **$6,769.47 is the tax Phase 27 refused rather than omit.** Its own
         * refusal said "roughly 15.3% of 92.35% of this profit"; 15.3% of
         * $44,244.89 is $6,769.47 to the cent, which is the arithmetic check
         * that the two rates and the factor all landed where they belong.
         *
         * …and the rest of the page, once §199A lands (TAX-32):
         *
         *   1040 line 12e  standard deduction, single       $15,750.00
         *   1040 line 13b  no senior deduction                   $0.00
         *   Form 8995 2/4  QBI = 47,910.00 - 3,384.74      $44,525.26
         *   Form 8995 5/10 20% of 4,452,526 = 890,505.2      $8,905.05
         *   Form 8995 11   44,525.26 - 15,750.00 - 0.00     $28,775.26
         *   Form 8995 14   20% of 2,877,526 = 575,505.2      $5,755.05
         *   Form 8995 15   the LESSER of 10 and 14           $5,755.05
         *   1040 line 13a  = Form 8995 line 15               $5,755.05
         *   1040 line 14   15,750.00 + 5,755.05 + 0.00      $21,505.05
         *   1040 line 15   44,525.26 - 21,505.05            $23,020.21
         *
         * The income limitation BINDS: $8,905.05 is 20% of the business's own
         * income and $5,755.05 is 20% of what is left of it after the
         * standard deduction, and the printed line 15 takes the lesser. That
         * is the ordinary case for a proprietor with no other income, not an
         * edge case.
         */
        aRealisticFounderReturnComputesEndToEnd: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assertEq(income.line8.value, 4791000n, '1040 line 8 = $47,910.00 of business income')
            assertEq(income.line9.value, 4791000n, 'total income')
            assertEq(income.line10.value, 338474n, '1040 line 10 = $3,384.74, the deductible half')
            assertEq(income.line11a.value, 4452526n, 'AGI = $44,525.26')
            assertEq(income.line11b.value, 4452526n, 'restated on page 2')
            assertEq(tax.line23.value, 676947n, '1040 line 23 = $6,769.47 of self-employment tax')
            // 15.3% of $44,244.89 of net earnings, hand-computed from the two
            // printed rates rather than from the code: 4,424,489 x 1530 /
            // 10,000 = 676,946.817, and the printed form's two SEPARATE
            // roundings (12.4% then 2.9%) land one cent above it at 676,947.
            // Both are stated, because "the total equals 15.3% of the base"
            // is the check a reader will do and it is very slightly false.
            assertEq(4424489n * 1530n / 10000n, 676946n, '15.3% of the net earnings, truncated')
            assertEq(tax.line23.value - 676946n, 1n, 'the printed form rounds the two portions separately')
            // The one Schedule SE execution reached BOTH destinations, and
            // the deduction really is half the tax.
            assertEq(income.selfEmployment.lines.line12, tax.line23.value, 'Schedule 2 line 4 is line 12')
            assertEq(income.selfEmployment.lines.line13, income.line10.value, 'Schedule 1 line 15 is line 13')
            // …and line 10 cites the documents behind it, not the profile
            // alone: a $3,384.74 adjustment whose only citation was
            // `declaredKinds` would be a figure with no provenance (PROV-01).
            const hashes = income.line10.sources.map(source => source.documentHash)
            assert(
                hashes.includes('sha256-1099nec-01') && hashes.includes('sha256-business-01'),
                ['line 10 must cite the business documents the deduction came from', income.line10.sources])
            // ── §199A, on the same return (TAX-32) ───────────────────────
            assertEq(income.line12e.value, 1575000n, 'the single standard deduction')
            assertEq(income.line13b.value, 0n, 'no senior deduction on this return')
            assertEq(income.line13a.value, 575505n, '1040 line 13a = $5,755.05')
            assertEq(income.line14.value, 2150505n, '1040 line 14 = $21,505.05')
            assertEq(income.line15.value, 2302021n, '1040 line 15 = $23,020.21 of taxable income')
            // The income limitation really is what chose it: 20% of the QBI
            // is $8,905.05, hand-computed, and it is the LARGER.
            assertEq(4452526n * 20n / 100n, 890505n, '20% of the QBI is $8,905.05')
            assert(
                income.line13a.value < 890505n,
                ['the income limitation must bind here', income.line13a.value])
            // …and line 13a cites the documents, never the profile alone.
            const thirteenAHashes = income.line13a.sources.map(source => source.documentHash)
            assert(
                thirteenAHashes.includes('sha256-1099nec-01'),
                ['line 13a must cite the business income it deducts against', income.line13a.sources])
            // ── The bottom of the page ────────────────────────────────────
            //
            // The printed Tax Table's $23,000-$23,050 row prices the
            // $23,025.00 midpoint: 10% of $11,925.00 is $1,192.50 and 12% of
            // the remaining $11,100.00 is $1,332.00, so the row reads
            // $2,524.50 -> $2,525.00. Nothing was withheld, so the whole of
            // the income tax and the whole of the self-employment tax are
            // owed.
            assertEq(1192500n + 1332000n, 2524500n, 'the Tax Table row\'s own arithmetic')
            assertEq(tax.line16.value, 252500n, '1040 line 16 = $2,525.00')
            assertEq(tax.line24.value, 929447n, '1040 line 24 = $9,294.47 = $2,525.00 + $6,769.47')
            assertEq(tax.line33.value, 0n, 'nothing was withheld on this 1099-NEC')
            assertEq(tax.line37.value, 929447n, '1040 line 37: $9,294.47 owed')
        },
        /**
         * **THE WAGE-BASE COORDINATION, end to end**, and the fixture the
         * whole phase turns on: two jobs plus a business, where the naive
         * answer differs by $2,489.30 of tax.
         *
         * Two Forms W-2 for the SAME recipient totalling $150,000.00 of box 3
         * Social Security wages, beside a $50,000.00 Schedule C net profit
         * (no expenses). Every figure hand-derived:
         *
         *   Sch SE line 4a   92.35% of $50,000.00              $46,175.00
         *   Sch SE line 8a   box 3 + box 3                    $150,000.00
         *   Sch SE line 9    176,100.00 - 150,000.00           $26,100.00
         *   Sch SE line 10   12.4% of $26,100.00                $3,236.40
         *   Sch SE line 11   2.9% of $46,175.00                 $1,339.08
         *   Sch SE line 12   -> Schedule 2 line 4               $4,575.48
         *   Sch SE line 13   50% of $4,575.48                   $2,287.74
         *
         * **The naive answer — no sharing — is $7,064.78**, because 12.4% of
         * the whole $46,175.00 is $5,725.70 rather than $3,236.40. Both are
         * asserted, so a wiring that never reached box 3 lands on the second
         * and says so.
         */
        theWageBaseIsSharedWithWTwoBoxThreeWagesEndToEnd: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([
                w2WithSocialSecurityWages('sha256-w2-day-job')('85000.00'),
                w2WithSocialSecurityWages('sha256-w2-evening-job')('65000.00'),
            ])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('50000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('0.00')]))
            assertEq(income.selfEmployment.lines.line8a, 15000000n, 'line 8a = $150,000.00 of box 3')
            assertEq(income.selfEmployment.lines.line9, 2610000n, 'line 9 = $26,100.00 of base left')
            assertEq(income.selfEmployment.lines.line10, 323640n, 'line 10 = $3,236.40')
            assertEq(income.selfEmployment.lines.line11, 133908n, 'line 11 = $1,339.08, uncapped')
            assertEq(tax.line23.value, 457548n, '1040 line 23 = $4,575.48')
            assertEq(income.line10.value, 228774n, '1040 line 10 = $2,287.74, half of $4,575.48')
            // THE NAIVE ANSWER, hand-computed: 12.4% of the whole $46,175.00
            // is $5,725.70, which with the $1,339.08 Medicare portion would
            // be $7,064.78 -- $2,489.30 more tax than is owed.
            assertEq(4617500n * 1240n / 10000n, 572570n, 'no sharing: $5,725.70')
            assertEq(572570n + 133908n - 457548n, 248930n, '$2,489.30 of tax the sharing removes')
            // …and the wages are on 1040 line 1a too, where they always were.
            assertEq(income.line1a.value, 15000000n, 'box 1 still reaches line 1a')
        },
        /**
         * **CRITERION 5, as a checked claim**: a return with no business
         * income computes EXACTLY what it computed before this phase. The
         * fixture is the $45,505.00 wage-earner this file has carried since
         * Phase 10 — the same box-1 figure Phase 21's own end-to-end leaf
         * pins through the stored program (`1040 line 1a = $45,505.00`,
         * `1040 line 34 = $5,535.00`), which is why it is the one worth
         * re-stating here.
         *
         * What this leaf adds to the assertions already in this file is the
         * statement that those figures are unmoved BY THIS PHASE
         * specifically, with the new `nonemployeeCompensationForms` and
         * `businessExpenseForms` fields present and explicitly EMPTY — so a
         * future change that starts reading something out of an empty list
         * has one place that says what the answer was.
         */
        /**
         * **CRITERION 3, END TO END, half one: the GENERAL PARTNER.**
         *
         * A single filer whose only income is an $80,000.00 general-partner
         * share. Every figure hand-derived, in printed order:
         *
         *   Sch E line 28(j)  nonpassive income from Schedule K-1  $80,000.00
         *   Sch E line 41     -> Schedule 1 line 5                 $80,000.00
         *   1040 line 8       Schedule 1 line 10                   $80,000.00
         *   1040 line 9       total income (no wages)              $80,000.00
         *   Sch SE line 4a    92.35% of $80,000.00                 $73,880.00
         *     8,000,000 x 9,235 = 73,880,000,000; / 10,000 = 7,388,000 exactly
         *   Sch SE line 10    12.4% of $73,880.00                   $9,161.12
         *   Sch SE line 11    2.9% of $73,880.00                    $2,142.52
         *   Sch SE line 12    -> Schedule 2 line 4 -> 1040 line 23 $11,303.64
         *   Sch SE line 13    50% -> Schedule 1 line 15 -> line 10  $5,651.82
         *   1040 line 11      $80,000.00 - $5,651.82               $74,348.18
         *   1040 line 12e     single standard deduction            $15,750.00
         *   1040 line 15      $74,348.18 - $15,750.00              $58,598.18
         *   1040 line 16      Tax Table                             $7,801.00
         *   1040 line 24      $7,801.00 + $11,303.64               $19,104.64
         *
         * The Tax Table row is $58,550-$58,600 and prices its $58,575.00
         * midpoint: 10% of $11,925.00 is $1,192.50, 12% of the $36,550.00 up
         * to $48,475.00 is $4,386.00, and 22% of the remaining $10,100.00 is
         * $2,222.00 — $7,800.50, rounded to $7,801.00.
         */
        theGeneralPartnersShareIsTaxedEndToEndAtElevenThousandThreeHundredAndThreeSixtyFour: () => {
            const base = inputsOf(storedProfile(passThroughProfile))([])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(
                withPassThrough(base)([partnershipK1Document('sha256-k1-1065-01')('80000.00')])([]))
            // Criterion 2: the income reaches 1040 line 8 THROUGH Schedule 1's
            // own Part I total, and line 8 CITES the Schedule K-1 rather than
            // the profile — which is what distinguishes a real reading from a
            // documented zero that happens to be the right size.
            assertEq(income.line8.value, 8000000n, '1040 line 8 = $80,000.00')
            const eightHashes = income.line8.sources.map(source => source.documentHash)
            assert(
                eightHashes.includes('sha256-k1-1065-01'),
                ['line 8 must cite the Schedule K-1', income.line8.sources])
            assertEq(income.line9.value, 8000000n, '1040 line 9: no wages, so line 8 is all of it')
            // Schedule SE, cent by cent.
            assertEq(income.selfEmployment.lines.line2, 8000000n, 'Sch SE line 2 = box 14 code A')
            assertEq(income.selfEmployment.lines.line4a, 7388000n, 'Sch SE line 4a = $73,880.00')
            assertEq(income.selfEmployment.lines.line10, 916112n, 'Sch SE line 10 = $9,161.12')
            assertEq(income.selfEmployment.lines.line11, 214252n, 'Sch SE line 11 = $2,142.52')
            assertEq(tax.line23.value, 1130364n, '1040 line 23 = $11,303.64 of self-employment tax')
            assertEq(income.line10.value, 565182n, '1040 line 10 = $5,651.82, half of $11,303.64')
            assertEq(income.line11a.value, 7434818n, 'AGI = $74,348.18')
            assertEq(income.line12e.value, 1575000n, 'single standard deduction $15,750.00')
            assertEq(income.line13a.value, 0n, 'no §199A deduction: Reg. §1.199A-6(b)(3)(iii)')
            assertEq(income.line15.value, 5859818n, 'taxable income $58,598.18')
            assertEq(1192500n + 438600n + 222200n, 1853300n, 'the Tax Table row\'s three brackets')
            assertEq(tax.line16.value, 780100n, '1040 line 16 = $7,801.00')
            assertEq(tax.line24.value, 1910464n, '1040 line 24 = $19,104.64')
            assertEq(tax.line33.value, 0n, 'a Schedule K-1 carries no withholding')
            assertEq(tax.line37.value, 1910464n, '1040 line 37: $19,104.64 owed')
        },
        /**
         * **CRITERION 3, END TO END, half two: the S-CORPORATION
         * SHAREHOLDER**, and the pair's whole point.
         *
         * The SAME $80,000.00, the same filing status, the same declared kind,
         * the same everything — except that the share arrives on a Schedule
         * K-1 (Form 1120-S) instead of a Schedule K-1 (Form 1065). Rev. Rul.
         * 59-221 makes that difference worth **$11,303.64**:
         *
         *   1040 line 8       -> unchanged                        $80,000.00
         *   1040 line 23      NO self-employment tax                   $0.00
         *   1040 line 10      no deductible half                       $0.00
         *   1040 line 11      AGI is the whole share               $80,000.00
         *   1040 line 15      $80,000.00 - $15,750.00              $64,250.00
         *   1040 line 16      Tax Table                             $9,055.00
         *   1040 line 24      $9,055.00 + $0.00                     $9,055.00
         *
         * The Tax Table row is $64,250-$64,300 and prices its $64,275.00
         * midpoint: $1,192.50 + $4,386.00 + 22% of the remaining $15,800.00,
         * which is $3,476.00 — $9,054.50, rounded to $9,055.00.
         *
         * **The equalities are asserted as well as the differences**, because
         * "the only difference is the entity type" is a claim about the
         * fixtures and not only about the answer: a wiring that read the
         * 1120-S box 1 into the wrong place would break the first line here
         * rather than the last.
         */
        anSCorporationShareholderOwesNoSelfEmploymentTaxOnTheSameEightyThousand: () => {
            const base = inputsOf(storedProfile(passThroughProfile))([])([])([])([])([])([])([])([])([])
            const partner = computedLines(
                withPassThrough(base)([partnershipK1Document('sha256-k1-1065-01')('80000.00')])([]))
            const shareholder = computedLines(
                withPassThrough(base)([])([sCorporationK1Document('sha256-k1-1120s-01')('80000.00')]))
            // THE SAME.
            assertEq(shareholder.income.line8.value, 8000000n, '1040 line 8 = $80,000.00')
            assertEq(shareholder.income.line8.value, partner.income.line8.value)
            assertEq(shareholder.income.line9.value, partner.income.line9.value)
            assertEq(shareholder.income.line12e.value, partner.income.line12e.value)
            // THE DIFFERENT.
            assertEq(shareholder.income.selfEmployment.lines.line2, 0n, 'Sch SE line 2 = $0.00')
            assertEq(shareholder.tax.line23.value, 0n, '1040 line 23 = $0.00 — Rev. Rul. 59-221')
            assertEq(partner.tax.line23.value, 1130364n, 'and the partner owes $11,303.64')
            assertEq(shareholder.income.line10.value, 0n, 'no deductible half to subtract')
            assertEq(shareholder.income.line11a.value, 8000000n, 'AGI is the whole $80,000.00')
            assertEq(
                shareholder.income.line11a.value - partner.income.line11a.value,
                565182n,
                'the AGI gap is exactly Schedule SE line 13')
            assertEq(shareholder.income.line15.value, 6425000n, 'taxable income $64,250.00')
            assertEq(1192500n + 438600n + 347600n, 1978700n, 'the Tax Table row\'s three brackets')
            assertEq(shareholder.tax.line16.value, 905500n, '1040 line 16 = $9,055.00')
            assertEq(shareholder.tax.line24.value, 905500n, '1040 line 24 = $9,055.00')
            // The whole difference, priced: $19,104.64 - $9,055.00.
            assertEq(
                partner.tax.line24.value - shareholder.tax.line24.value,
                1004964n,
                'the entity type is worth $10,049.64 of total tax on the same $80,000.00')
        },
        theWageEarnerReturnIsUnmovedByThisPhase: () => {
            const base = inputsOf(storedProfile(unemploymentProfile))([
                w2WithWithholding('sha256-w2-01')('45505.00')('8962.00'),
            ])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([])([]))
            assertEq(income.line1a.value, 4550500n, '$45,505.00, exactly as before Phase 27')
            assertEq(income.line8.value, 0n, 'and nothing on Schedule 1 Part I')
            assertEq(tax.line25b.value, 0n)
            assertEq(income.line11a.value, 4550500n, 'AGI is wages alone')
            // **PHASE 28's OWN half of this claim.** The three lines this
            // phase made real are all $0.00 here, and each still cites the
            // profile's `declaredKinds` box alone — so the wage-earner
            // return's AGI, taxable income, tax and refund are untouched by
            // Schedule SE and §199A. Phase 21's own end-to-end figures
            // (`1040 line 1a = 4550500n`, `1040 line 34 = 553500n`) depend on
            // exactly this, and line 34 is asserted here rather than left to
            // the other file.
            assertEq(income.line10.value, 0n, 'Schedule 1 line 15 adds nothing to line 10')
            assertEq(income.line10.sources.length, 1, 'and line 10 still cites one box')
            assertEq(income.line10.sources[0].boxPath, 'declaredKinds')
            assertEq(tax.line23.value, 0n, 'Schedule 2 line 4 adds nothing to line 23')
            assertEq(income.line13a.value, 0n, 'no qualified business income, no §199A deduction')
            // …and line 13a is still the DOCUMENTED ZERO it has always been,
            // citing the profile alone rather than a union of facts Form 8995
            // read. `scheduleC.filed` is what tells a return with no business
            // apart from a break-even one, and this is the assertion that
            // makes that branch load-bearing.
            assertEq(income.line13a.sources.length, 1, 'one citation, the profile')
            assertEq(income.line13a.sources[0].boxPath, 'declaredKinds')
            // This fixture is a JOINT return, so the deduction is $31,500.00
            // rather than single's $15,750.00: $45,505.00 - $31,500.00 =
            // $14,005.00 of taxable income, and the printed Tax Table's
            // $14,000-$14,050 row gives $1,403.00 of tax (10% of the
            // $14,025.00 midpoint is $1,402.50, rounded). $8,962.00 withheld
            // less $1,403.00 is a $7,559.00 refund.
            //
            // Phase 21's own end-to-end fixture is a DIFFERENT return at the
            // same $45,505.00 of wages — `1040 line 34 = 553500n` — and it
            // runs through the stored guest program in
            // `fjs-run-integration.test.js` rather than here. Both are
            // unmoved; only this one is asserted in this file.
            assertEq(income.line15.value, 1400500n, '$45,505.00 - $31,500.00 = $14,005.00')
            assertEq(tax.line16.value, 140300n, 'the Tax Table row gives $1,403.00')
            assertEq(tax.line34.value, 755900n, 'overpaid $7,559.00 = $8,962.00 - $1,403.00')
        },
        /**
         * **THE DEDUCTIBLE HALF EXCLUDES THE ADDITIONAL MEDICARE TAX**, and
         * this is the leaf that prices the difference. §164(f)(1) allows a
         * deduction for one-half of *"the taxes imposed by section 1401"* —
         * §3101(b)(2)'s 0.9% is not among them, and it is charged on Form
         * 8959 reaching Schedule 2 line **11**, not line 4.
         *
         * A single filer with a **$220,000.00** Schedule C net profit and no
         * wages. That figure is chosen to sit in a narrow band: net earnings
         * must exceed §3101(b)(2)'s $200,000 for Form 8959 Part II to charge
         * anything at all, while taxable income before §199A must stay at or
         * below §199A(e)(2)'s $197,300 or Form 8995-A applies and this engine
         * refuses. `aReturnAboveTheSectionOneNineNineAThresholdRefuses` is
         * that other side, at $300,000.
         *
         * Hand-derived:
         *
         *   Sch SE 4a/6  92.35% of $220,000.00              $203,170.00
         *   Sch SE 10    12.4% of the $176,100.00 base       $21,836.40
         *   Sch SE 11    2.9% of $203,170.00                  $5,891.93
         *   Sch SE 12    -> Schedule 2 line 4                $27,728.33
         *   Sch SE 13    2,772,833 x 50 / 100 = 1,386,416.5  $13,864.17
         *   8959 12      203,170.00 - 200,000.00              $3,170.00
         *   8959 13      0.9% of $3,170.00                       $28.53
         *   1040 line 23 27,728.33 + 28.53                   $27,756.86
         *
         * **Half of $27,756.86 is $13,878.43**, which is $14.26 more than the
         * $13,864.17 §164(f) actually allows. Both figures are asserted, so a
         * line 15 built as "half of everything on line 23" lands on the wrong
         * one and says so.
         */
        theDeductibleHalfExcludesTheAdditionalMedicareTax: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('220000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('0.00')]))
            assertEq(income.selfEmployment.lines.line6, 20317000n, 'net earnings $203,170.00')
            assertEq(income.selfEmployment.lines.line10, 2183640n, '12.4% of the capped base')
            assertEq(income.selfEmployment.lines.line11, 589193n, '2.9%, uncapped')
            assertEq(income.selfEmployment.lines.line12, 2772833n, 'Schedule SE line 12 = $27,728.33')
            assertEq(income.line10.value, 1386417n, 'line 15 = $13,864.17, half-up from 1,386,416.5')
            assertEq(tax.line23.value, 2775686n, '1040 line 23 = $27,756.86, INCLUDING the 0.9%')
            // The wrong answer, hand-computed, and asserted to differ.
            assertEq(2775686n / 2n, 1387843n, 'half of everything on line 23 would be $13,878.43')
            assert(
                income.line10.value !== 1387843n,
                ['§164(f)(1) halves the §1401 taxes alone', income.line10.value])
            assertEq(1387843n - 1386417n, 1426n, '$14.26 of deduction that is not allowed')
            // …and the $28.53 really is on Schedule 2 line 11 rather than
            // line 4, which is the structural reason the two halves differ.
            assertEq(tax.line23.value - income.selfEmployment.lines.line12, 2853n,
                'the Additional Medicare Tax on self-employment income, $28.53')
        },
        /**
         * **THE §199A THRESHOLD, at the report.** The same fixture one step
         * larger — a $300,000.00 net profit — puts taxable income before the
         * deduction at $269,314.57, above §199A(e)(2)'s $197,300, so Form
         * 8995-A applies and this engine refuses the WHOLE report rather than
         * computing the simplified form anyway.
         *
         * This is the leaf that says the threshold is measured against
         * TAXABLE income rather than against the profit or the AGI: a
         * $300,000 profit is nowhere near $197,300, but the figure the form
         * compares is what is left after the standard deduction, and it is
         * $269,314.57 rather than $300,000.00.
         */
        aReturnAboveTheSectionOneNineNineAThresholdRefuses: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('300000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('0.00')]))
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 0, 'a document-data-sufficiency refusal names no kind')
            assert(outcome.message.includes('8995-A'), ['must name the form', outcome.message])
            assert(
                outcome.message.includes('26931457'),
                ['must quote the taxable income it compared', outcome.message])
            // Hand-derived, so the figure above is checkable without running
            // the engine: 92.35% of $300,000 is $277,050; 12.4% of the
            // $176,100 base is $21,836.40 and 2.9% of $277,050 is $8,034.45,
            // so Schedule SE line 12 is $29,870.85 and line 13 is $14,935.43.
            // AGI is $300,000.00 - $14,935.43 = $285,064.57, and taxable
            // income before §199A is that less the $15,750.00 standard
            // deduction: $269,314.57.
            assertEq(2987085n / 2n + 1n, 1493543n, 'the deductible half, half-up')
            assertEq(30000000n - 1493543n - 1575000n, 26931457n, '$269,314.57')
        },
        /**
         * **THE CARRYFORWARD ASSERTION, at the report.** The identical
         * fixture with the field REMOVED refuses, so §199A(c)(2)'s
         * carryforward cannot be silently read as zero for the year-one-loss
         * founder it exists for. The control is every other leaf in this
         * group, all of which supply `'0.00'`.
         */
        aBusinessWithNoCarryforwardAssertionRefuses: () => {
            const record = businessExpensesDocument('sha256-business-01')('90.00')
            /** @type {Stored<BusinessExpenses>} */
            const withoutAssertion = {
                documentHash: record.documentHash,
                value: {
                    ...record.value,
                    priorYearQualifiedBusinessLossCarryforward: undefined,
                },
            }
            const base = inputsOf(storedProfile(selfEmploymentProfile))([])([])([])([])([])([])([])([])([])
            const outcome = form1040IncomeLines(taxParams2025)(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([withoutAssertion]))
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assert(
                outcome.message.includes('priorYearQualifiedBusinessLossCarryforward'),
                ['must name the field that fixes it', outcome.message])
            assert(outcome.message.includes('§199A(c)(2)'), ['must name the section', outcome.message])
        },
        /**
         * **A SENIOR FOUNDER, and the leaf a mutation demanded.** Zeroing
         * `additionalDeductionsCents` at the Form 8995 call site — i.e.
         * leaving 1040 line 13b INSIDE the limitation base — left the whole
         * suite green, because no fixture in this repository had both a
         * business and a senior deduction. AGENTS.md: *"after wiring
         * anything, ask what fixture actually observes it."* Nothing did.
         *
         * A 65-or-over single filer with the same $48,000.00 business:
         *
         *   1040 line 11a  AGI, as in the leaf above          $44,525.26
         *   1040 line 12e  15,750.00 + 2,000.00 aged          $17,750.00
         *   1040 line 13b  Schedule 1-A, unphased at this AGI  $6,000.00
         *   Form 8995 11   44,525.26 - 17,750.00 - 6,000.00   $20,775.26
         *   Form 8995 14   20% of 2,077,526 = 415,505.2        $4,155.05
         *   Form 8995 10   20% of the QBI, as above            $8,905.05
         *   1040 line 13a  the lesser                          $4,155.05
         *
         * **Leaving line 13b in would give $26,775.26 on Form 8995 line 11
         * and $5,355.05 on line 13a** — $1,200.00 too much deduction, which
         * is 20% of the senior deduction, for exactly the filer OBBBA's
         * senior deduction was written for. Both figures are asserted.
         */
        theSeniorDeductionComesOutOfTheSectionOneNineNineALimitationBase: () => {
            const seniorFounder = {
                ...selfEmploymentProfile,
                taxpayerBornBeforeJan2_1961: /** @type {const} */ (true),
                declaredKinds: [
                    'businessIncomeOrLoss',
                    'federalTaxWithheldOnOther1099',
                    'seniorAndOtherScheduleOneADeductions',
                ],
            }
            const base = inputsOf(storedProfile(seniorFounder))([])([])([])([])([])([])([])([])([])
            const { income } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assertEq(income.line11a.value, 4452526n, 'AGI = $44,525.26, unchanged by age')
            assertEq(income.line12e.value, 1775000n, '$15,750.00 + $2,000.00 for the aged box')
            assertEq(income.line13b.value, 600000n, 'the full $6,000.00 senior deduction')
            assertEq(income.line13a.value, 415505n, '1040 line 13a = $4,155.05')
            // The WRONG answer, hand-computed and asserted to differ.
            assertEq(4452526n - 1775000n, 2677526n, 'leaving line 13b in gives $26,775.26')
            assertEq(2677526n * 20n / 100n, 535505n, 'and $5,355.05 of deduction')
            assert(
                income.line13a.value !== 535505n,
                ['line 13b must come out of the limitation base', income.line13a.value])
            assertEq(535505n - 415505n, 120000n, '$1,200.00 = 20% of the senior deduction')
        },
        /**
         * **A FOUNDER WITH A DAY JOB, and the THIRD leaf a mutation
         * demanded** — the subtlest of the three, and an "equivalent mutant"
         * that turned out not to be equivalent at all.
         *
         * Zeroing `deductibleHalfOfSelfEmploymentTaxCents` at the Form 8995
         * call site — i.e. NOT reducing qualified business income by the
         * §164(f) half, the step this form's docstring calls the one most
         * commonly missed — left the suite green even after the two fixtures
         * above were added. The reason is a property of the form rather than
         * a gap in intent: **in every fixture this file had, the INCOME
         * LIMITATION on line 14 was the smaller of the two, so line 15 took
         * it and nothing about line 10 could be observed at all.** A sole
         * proprietor with no other income always lands there, because the
         * standard deduction has already come off the limitation base.
         *
         * The reduction becomes observable only when line 10 is the smaller —
         * when taxable income is large relative to the business. A $120,000
         * salary beside the same $48,000 business is that return, and it is
         * also the commonest founder household there is:
         *
         *   1040 line 1a   W-2 box 1                        $120,000.00
         *   1040 line 8    Schedule C line 31                $47,910.00
         *   1040 line 10   the deductible half                $3,384.74
         *   1040 line 11a  167,910.00 - 3,384.74            $164,525.26
         *   Form 8995 4    47,910.00 - 3,384.74              $44,525.26
         *   Form 8995 10   20% of 4,452,526 = 890,505.2       $8,905.05
         *   Form 8995 11   164,525.26 - 15,750.00           $148,775.26
         *   Form 8995 14   20% of 14,877,526 = 2,975,505.2   $29,755.05
         *   1040 line 13a  the lesser — now line 10           $8,905.05
         *
         * **Without the reduction, qualified business income would be the
         * whole $47,910.00 and line 13a would be $9,582.00** — $676.95 too
         * much, which is 20% of the deductible half. Both are asserted.
         *
         * The wage base is shared here too: $120,000 of box 3 leaves
         * $56,100 of it, which is more than the $44,244.89 of net earnings,
         * so the cap does NOT bind and Schedule SE line 12 is the same
         * $6,769.47 as with no wages at all. That is asserted, because a
         * reader comparing this leaf with
         * `theWageBaseIsSharedWithWTwoBoxThreeWagesEndToEnd` should be able
         * to see why one shares and the other binds.
         */
        theDeductibleHalfReducesQualifiedBusinessIncomeWhenTheLimitationDoesNotBind: () => {
            const base = inputsOf(storedProfile(selfEmploymentProfile))([
                w2WithSocialSecurityWages('sha256-w2-day-job')('120000.00'),
            ])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assertEq(income.line1a.value, 12000000n, '$120,000.00 of wages')
            assertEq(income.line8.value, 4791000n, '$47,910.00 of business income')
            assertEq(income.line10.value, 338474n, 'the deductible half, $3,384.74')
            assertEq(income.line11a.value, 16452526n, 'AGI = $164,525.26')
            assertEq(income.line13a.value, 890505n, '1040 line 13a = $8,905.05')
            // The WRONG answer, hand-computed and asserted to differ: 20% of
            // the UNREDUCED $47,910.00 is $9,582.00.
            assertEq(4791000n * 20n / 100n, 958200n, 'unreduced QBI would give $9,582.00')
            assert(
                income.line13a.value !== 958200n,
                ['§199A(c)(1) reduces QBI by the §164(f) half', income.line13a.value])
            assertEq(958200n - 890505n, 67695n, '$676.95 = 20% of $3,384.74')
            // …and the income limitation genuinely does NOT bind here, which
            // is the whole reason this fixture can see the reduction: 20% of
            // $148,775.26 is $29,755.05, hand-computed.
            assertEq(14877526n * 20n / 100n, 2975505n, 'the limitation is $29,755.05, far larger')
            // The wage base is shared and does not bind: $176,100.00 less
            // $120,000.00 is $56,100.00, more than the $44,244.89 of net
            // earnings, so the Social Security portion is the same as with no
            // wages at all.
            assertEq(income.selfEmployment.lines.line8a, 12000000n, '$120,000.00 of box 3')
            assertEq(income.selfEmployment.lines.line9, 5610000n, '$56,100.00 of base left')
            assertEq(income.selfEmployment.lines.line12, 676947n, '$6,769.47, the uncapped figure')
            assertEq(tax.line23.value, 676947n, '1040 line 23 = $6,769.47')
        },
        /**
         * **A PRIOR-YEAR LOSS CARRYFORWARD, through the product path** — and
         * the FOURTH gap the mutation hunt found. Reading the stored
         * assertion's VALUE as `'0.00'` whenever it was present left the
         * suite green: every product-path fixture asserted `'0.00'`, so the
         * one figure the field exists to carry was never non-zero anywhere.
         *
         * The same $120,000-salary founder, whose line 10 binds so the
         * carryforward is visible in the deduction at all, with an
         * $18,400.00 loss carried in from the business's first year:
         *
         *   Form 8995 2   QBI, as above                       $44,525.26
         *   Form 8995 3   the carryforward, NEGATED           -$18,400.00
         *   Form 8995 4   44,525.26 - 18,400.00               $26,125.26
         *   Form 8995 5   20% of 2,612,526 = 522,505.2         $5,225.05
         *   1040 line 13a the lesser (line 14 is $29,755.05)   $5,225.05
         *
         * **$3,680.00 less deduction than the identical return without the
         * carryforward** — 20% of $18,400.00 — and that is the whole reason
         * the field cannot be allowed to default to zero. Year one's loss and
         * year two's profit is the canonical §199A(c)(2) sequence, and it is
         * this phase's own persona.
         */
        aPriorYearLossCarryforwardReachesLineThirteenA: () => {
            const record = businessExpensesDocument('sha256-business-01')('90.00')
            /** @type {Stored<BusinessExpenses>} */
            const withCarryforward = {
                documentHash: record.documentHash,
                value: {
                    ...record.value,
                    priorYearQualifiedBusinessLossCarryforward: '18400.00',
                },
            }
            const base = inputsOf(storedProfile(selfEmploymentProfile))([
                w2WithSocialSecurityWages('sha256-w2-day-job')('120000.00'),
            ])([])([])([])([])([])([])([])([])
            const { income } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([withCarryforward]))
            assertEq(income.line13a.value, 522505n, '1040 line 13a = $5,225.05')
            // …and the identical return WITHOUT it, so the reduction is
            // observable rather than merely present.
            const { income: without } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([record]))
            assertEq(without.line13a.value, 890505n, 'without the carryforward, $8,905.05')
            assertEq(without.line13a.value - income.line13a.value, 368000n, '$3,680.00 = 20% of $18,400.00')
        },
        /**
         * **A FOUNDER WITH DIVIDENDS, and the second leaf a mutation
         * demanded.** Zeroing `netCapitalGainCents` at the Form 8995 call
         * site also left the suite green: no fixture had both a business and
         * a capital gain, so Form 8995 line 12 was $0.00 everywhere and the
         * whole line-12/13 subtraction was unobservable through the product
         * path.
         *
         * The same $48,000.00 business plus $12,000.00 of qualified
         * dividends:
         *
         *   1040 line 3a/3b  qualified = ordinary dividends   $12,000.00
         *   1040 line 11a    47,910.00 + 12,000.00 - 3,384.74 $56,525.26
         *   Form 8995 11     56,525.26 - 15,750.00            $40,775.26
         *   Form 8995 12     net capital gain = line 3a       $12,000.00
         *   Form 8995 13     40,775.26 - 12,000.00            $28,775.26
         *   Form 8995 14     20% of 2,877,526 = 575,505.2      $5,755.05
         *   Form 8995 10     20% of the QBI                    $8,905.05
         *   1040 line 13a    the lesser                        $5,755.05
         *
         * **Without the line-12 subtraction line 13 would be $40,775.26 and
         * line 14 $8,155.05**, which is $2,400.00 — 20% of the dividends —
         * too much deduction. Both are asserted.
         *
         * The dividends are QUALIFIED, which is what makes them net capital
         * gain at all: ordinary dividends alone are not, and this fixture
         * sets box 1a and box 1b to the same amount so the two 1040 lines
         * carry the same figure and only line 3a reaches Form 8995.
         */
        netCapitalGainComesOutOfTheSectionOneNineNineALimitationBase: () => {
            const dividendFounder = {
                ...selfEmploymentProfile,
                declaredKinds: [
                    'businessIncomeOrLoss',
                    'federalTaxWithheldOnOther1099',
                    'qualifiedDividends',
                    'ordinaryDividends',
                ],
            }
            const base = inputsOf(storedProfile(dividendFounder))([])([])([
                dividendDocument('sha256-1099div-01')({
                    box1aTotalOrdinaryDividends: '12000.00',
                    box1bQualifiedDividends: '12000.00',
                }),
            ])([])([])([])([])([])([])
            const { income } = computedLines(withBusiness(base)([
                nonemployeeCompensationDocument('sha256-1099nec-01')('48000.00')('0.00'),
            ])([businessExpensesDocument('sha256-business-01')('90.00')]))
            assertEq(income.line3a.value, 1200000n, '$12,000.00 of qualified dividends')
            assertEq(income.line11a.value, 5652526n, 'AGI = $56,525.26')
            assertEq(income.line13a.value, 575505n, '1040 line 13a = $5,755.05')
            // The WRONG answer, hand-computed and asserted to differ.
            assertEq(5652526n - 1575000n, 4077526n, 'Form 8995 line 11 = $40,775.26')
            assertEq(4077526n * 20n / 100n, 815505n, 'without line 12 the limitation is $8,155.05')
            assert(
                income.line13a.value !== 815505n,
                ['net capital gain must come out of the limitation base', income.line13a.value])
            assertEq(815505n - 575505n, 240000n, '$2,400.00 = 20% of the qualified dividends')
        },
        /**
         * **ONE RULE, ONE PLACE, checked**: Form 8995 line 12's "net capital
         * gain" and the Qualified Dividends and Capital Gain Tax Worksheet's
         * lines 2 + 3 are the same quantity, transcribed twice — once in
         * `fjs/form8995` and once inside `fjs/tax/line16/qdcgt`'s own big
         * transcription, where it is a private `const` that cannot be
         * imported.
         *
         * AGENTS.md: *"a hand-typed list drifts unless something COMPARES it
         * to what it mirrors."* This is that comparison, run over the four
         * shapes that distinguish the rule — with and without a Schedule D,
         * with a loss on one of its lines, and with two unequal gains where
         * the `min` matters.
         */
        formEightNineNineFivesNetCapitalGainIsTheWorksheetsOwn: () => {
            /** @type {readonly (readonly [boolean, bigint, bigint, bigint, bigint])[]} */
            const shapes = [
                // filingScheduleD, D15, D16, line7a, qualifiedDividends
                [false, 0n, 0n, 40000n, 30000n],
                [true, 100000n, 150000n, 150000n, 30000n],
                [true, 150000n, 100000n, 100000n, 30000n],
                [true, -300000n, 150000n, 0n, 30000n],
                [true, 0n, 150000n, 150000n, 0n],
            ]
            assertEq(shapes.length, 5, 'five shapes, hand-typed')
            for (const [filingScheduleD, d15, d16, line7aCents, qualifiedDividendsCents] of shapes) {
                const worksheet = qdcgt(taxParams2025)({
                    status: 'single',
                    line1Cents: 10000000n,
                    line2Cents: qualifiedDividendsCents,
                    filingScheduleD,
                    scheduleD15Cents: d15,
                    scheduleD16Cents: d16,
                    line7aCents,
                })
                assertEq(
                    netCapitalGainLine12({
                        qualifiedDividendsCents, filingScheduleD,
                        scheduleD15Cents: d15, scheduleD16Cents: d16, line7aCents,
                    }),
                    worksheet.line2 + worksheet.line3,
                    ['Form 8995 line 12 must equal QDCGT lines 2 + 3', filingScheduleD, d15, d16],
                )
            }
        },
    },
    // ── 1099-INT box 9: the §57(a)(5) preference, and the double count it
    //    would be if any regular-tax line read it ────────────────────────────
    privateActivityBonds: {
        /**
         * **The no-double-count guard.** Box 9 is a SUBSET of box 8: the
         * private-activity slice of the same tax-exempt interest. 1040 line 2a
         * already sums box 8, so a second summand anywhere in Parts I or II
         * would tax the same interest twice — and §103(a) excludes every cent
         * of it from gross income regardless, which is why the AMT is the only
         * place it may appear at all.
         *
         * Two returns with the SAME box 8 and different box 9. Every 1040
         * figure must be identical; only the AMT input moves. Asserting the
         * equality of the whole printed return, rather than of line 2a alone,
         * is deliberate — a future edit that reads box 9 into line 2b, or into
         * the Social Security worksheet through line 2a, would slip past a
         * line-2a-only assertion.
         */
        lineTwoAIsUnmovedByBoxNine: () => {
            const withoutBoxNine = interestDocument('sha256-int-muni-a')({
                box1InterestIncome: '500.00',
                box8TaxExemptInterest: '60000.00',
            })
            const withBoxNine = interestDocument('sha256-int-muni-b')({
                box1InterestIncome: '500.00',
                box8TaxExemptInterest: '60000.00',
                box9SpecifiedPrivateActivityBondInterest: '60000.00',
            })
            /** @type {(form: Stored<OneZeroNineNineInt>) => ReturnType<typeof computedLines>} */
            const linesFor = form => computedLines(
                inputsOf(storedProfile(singleProfile))([])([form])([])([])([])([])([])([])([]))
            const plain = linesFor(withoutBoxNine)
            const preference = linesFor(withBoxNine)
            // $60,000.00 of tax-exempt interest is REPORTED on line 2a and
            // taxed on no line at all, with or without box 9.
            assertEq(plain.income.line2a.value, 6000000n, '1040 line 2a = box 8 = $60,000.00')
            assertEq(preference.income.line2a.value, 6000000n, 'and box 9 does not add to it')
            assertEq(plain.income.line2b.value, 50000n, 'line 2b = box 1 = $500.00')
            assertEq(preference.income.line2b.value, 50000n, 'box 9 is not taxable interest either')
            assertEq(plain.income.line9.value, preference.income.line9.value, 'total income unmoved')
            assertEq(plain.income.line15.value, preference.income.line15.value, 'taxable income unmoved')
            assertEq(plain.tax.line16.value, preference.tax.line16.value, 'the regular tax is unmoved')
            // ...and box 9 IS read, exactly once, on its own carrier. Without
            // this the leaf above would pass on a box 9 nothing reads at all,
            // which is the shape that let `box13StatutoryEmployee` sit unread
            // for eight phases.
            assertEq(
                plain.income.specifiedPrivateActivityBondInterest.value, 0n,
                'no box 9 means no preference')
            assertEq(
                preference.income.specifiedPrivateActivityBondInterest.value, 6000000n,
                'box 9 reaches Form 6251 line 2g as $60,000.00')
        },

        /** Box 9 short of box 8 — the ordinary muni holder, part private-activity. */
        aPartialPrivateActivitySliceIsCarriedAsItself: () => {
            const { income } = computedLines(inputsOf(storedProfile(singleProfile))([])([
                interestDocument('sha256-int-muni-c')({
                    box8TaxExemptInterest: '10000.00',
                    box9SpecifiedPrivateActivityBondInterest: '2500.00',
                }),
            ])([])([])([])([])([])([])([]))
            assertEq(income.line2a.value, 1000000n, 'all $10,000.00 is tax-exempt')
            assertEq(
                income.specifiedPrivateActivityBondInterest.value, 250000n,
                'and $2,500.00 of it is the §57(a)(5) preference')
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
        /**
         * **The end-to-end claim for the 1099-G work.** Unemployment
         * compensation must travel 1099-G box 1 → Schedule 1 line 7 → line 10
         * → 1040 line 8, and its withholding must travel box 4 → 1040 line 25b.
         *
         * Asserted against a HAND-TYPED expectation at each hop, and paired
         * with the no-1099-G control below: an assertion that a line carries
         * $4,554 proves nothing on its own if the line would carry $4,554
         * anyway.
         */
        unemploymentReachesLineEightAndItsWithholdingReachesLineTwentyFiveB: () => {
            const base = inputsOf(storedProfile(unemploymentProfile))([
                w2WithWithholding('sha256-w2-01')('45505.00')('8962.00'),
            ])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withUnemployment(base)([
                unemploymentDocument('sha256-1099g-01')('4554.00')('454.00'),
            ]))
            assertEq(income.line8.value, 455400n, '1040 line 8 carries the $4,554.00 of unemployment')
            assertEq(income.line1a.value, 4550500n, 'and wages are untouched at $45,505.00')
            assertEq(income.line9.value, 5005900n, 'total income = $45,505.00 + $4,554.00')
            assertEq(tax.line25b.value, 45400n, '1040 line 25b carries the $454.00 withheld on the 1099-G')
            // Line 8 is Schedule 1's Part I TOTAL, so it unions the sources of
            // every Part I line — the profile's `declaredKinds` (behind the six
            // still-zero lines) AND the 1099-G behind line 7. The 1099-G must be
            // PRESENT; it is not first, and asserting that it were would be
            // asserting an accident of union order rather than provenance.
            assert(
                income.line8.sources.some(source =>
                    source.documentHash === 'sha256-1099g-01'
                    && source.boxPath === 'box1UnemploymentCompensation'),
                ['line 8 must cite the 1099-G box it came from', income.line8.sources])
        },

        /**
         * The control. The SAME return with no 1099-G: line 8 falls to zero
         * and line 25b loses exactly the 1099-G's withholding. Without this,
         * the leaf above could pass on a line that was never reading the
         * document at all.
         */
        withoutAnyUnemploymentFormLineEightIsZeroAndTwentyFiveBDrops: () => {
            const base = inputsOf(storedProfile(unemploymentProfile))([
                w2WithWithholding('sha256-w2-01')('45505.00')('8962.00'),
            ])([])([])([])([])([])([])([])([])
            const { income, tax } = computedLines(withUnemployment(base)([]))
            assertEq(income.line8.value, 0n, 'no 1099-G means no line 8 income')
            assertEq(income.line9.value, 4550500n, 'total income is wages alone')
            assertEq(tax.line25b.value, 0n, 'and no 1099-family withholding')
            const [line8Source] = income.line8.sources
            assertEq(line8Source.boxPath, 'declaredKinds', 'the zero still carries profile provenance')
        },

        /**
         * The same return through the **FULL `form1040Report(...)` entry
         * point**, so the outer scope guard runs on the way.
         *
         * Both leaves above call `computedLines`, which reaches
         * `form1040IncomeLines`/`form1040TaxAndPaymentLines` directly and
         * **bypasses the scope guard entirely**. That makes them proofs about
         * the line assembly, not about the return — and it means neither of
         * them would have failed if `unemploymentCompensation` had been left
         * out of `modeledKinds`. The whole phase began with a real transcript
         * REFUSED at exactly that guard, so a proof that the refusal is now a
         * computation has to go through the thing that refused.
         *
         * $45,505.00 of wages plus $4,554.00 of unemployment is $50,059.00 of
         * total income; less the $31,500.00 MFJ standard deduction leaves
         * $18,559.00 taxable — hand-computed here, never read back off the
         * code under test.
         */
        unemploymentComputesThroughTheFullEntryPointWithTheGuardSatisfied: () => {
            const inputs = withUnemployment(
                inputsOf(storedProfile(unemploymentProfile))([
                    w2WithWithholding('sha256-w2-01')('45505.00')('8962.00'),
                ])([])([])([])([])([])([])([])([]))([
                    unemploymentDocument('sha256-1099g-01')('4554.00')('454.00'),
                ])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['the guard must now PASS on a declared unemployment return', outcome])
            assertEq(lineRuled(outcome.lines)('1040 line 8').value, 455400n, '$4,554.00 of unemployment')
            assertEq(lineRuled(outcome.lines)('1040 line 9').value, 5005900n, '$50,059.00 total income')
            assertEq(lineRuled(outcome.lines)('1040 line 15').value, 1855900n, '$18,559.00 taxable income')
            assertEq(lineRuled(outcome.lines)('1040 line 25b').value, 45400n, '$454.00 withheld on the 1099-G')
        },

        twentyFiveDSumsTwentyFiveAAndTwentyFiveBCitingEveryBox: () => {
            const { tax } = computedLines(inputsOf(storedProfile(withholdingProfile))([
                w2WithWithholding('sha256-w2-01')('50000.00')('5000.00'),
                w2WithWithholding('sha256-w2-02')('25000.00')('2500.00'),
            ])([
                interestDocument('sha256-int-01')({
                    box1InterestIncome: '100.00',
                    box4FederalIncomeTaxWithheld: '10.00',
                }),
            ])([])([])([])([])([])([])([]))
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
            ])([])([])([])([])([])([])([])([]))
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
                ])([])([])([])([])([])([])([])([]))
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
            ])([])([])([])([])([])([])([])([]))
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
            }))([])([])([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([]))
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
                ])([])([])([])([])([])([])([])([]))
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
                ])([])([])([])([])([])([])([])([]))
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
            ])([])([])([])([])([])([])([])([])
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
            }))([w2Document('sha256-w2-01')('50000.00')])([])([])([])([])([])([])([])([]))
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
                ])([])([])([])([])([])([])([])([]))
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
                }))([])([])([])([])([])([])([])([])([]))
            assert(refused.kind === 'error', ['expected a refusal', refused])
            assert(
                !Object.hasOwn(refused, 'lines'),
                ['a refused return must carry no line list at all', Object.keys(refused)],
            )
            const computed = form1040Report(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([]))
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
            }))([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(singleProfile))([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([]))
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
    // ── TAX-19: the computable tripwires, through the ENTRY POINT ────────
    //
    // `fjs/return/tripwire` proves the table and every predicate in isolation.
    // What can only be proven HERE is that the guard is actually WIRED — that
    // `form1040Report` runs it, that it runs before any line is computed, and
    // that it does not disturb the returns it has nothing to say about.
    //
    // The negative control below is not decoration and is not weaker than the
    // gate: a tripwire that always fires is not a tripwire, it is an outage,
    // and this engine's whole existing fixture set is the population it must
    // stay silent for.
    computableTripwires: {
        // THE CASE THE PHASE EXISTS FOR, end to end. A single filer with
        // $300,000 in W-2 box 5 owes Additional Medicare Tax whether or not
        // they have heard of Form 8959. Before this phase, this exact input
        // produced a confident, fully-cited 1040 understating the tax by
        // roughly $900, and nothing in the report said so.
        //
        // Each of the three actionable facts is asserted SEPARATELY, so
        // erasing any one of them reddens here and names which went missing
        // (AGENTS.md: assert the part of a message that carries information).
        aThreeHundredThousandDollarWageRefusesNamingForm8959AndLine23: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
                }))([w2WithMedicareWages('sha256-w2-faang')('300000.00')])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'error', ['a $300,000 box 5 must refuse the whole return', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled.length, 1, ['expected exactly one required kind', outcome.unmodeled])
            assertEq(outcome.unmodeled[0], 'additionalMedicareTax', ['expected Schedule 2 line 11 named', outcome.unmodeled])
            assert(
                outcome.message.includes('Form 8959'),
                ['the refusal must name the form the taxpayer needs', outcome.message])
            assert(
                outcome.message.includes('1040 line 23'),
                ['the refusal must name the 1040 line the tax lands on', outcome.message])
            assert(
                outcome.message.includes('box 5'),
                ['the refusal must name the box that proved it', outcome.message])
            // 10-CONTEXT.md Decision 2 holds for this arm as for every other:
            // a partial 1040 is never returned, and the error arm cannot
            // carry one at the type level.
            assert(
                !Object.hasOwn(outcome, 'lines'),
                ['a tripped return must carry no line list at all', Object.keys(outcome)])
        },
        // THE NEGATIVE CONTROL, and it is the more important half. The SAME
        // return shape, below the threshold, declaring nothing about Schedule
        // 2, computes a complete fifty-six-line 1040 — silently, with no
        // warning, no mention of Form 8959 anywhere in it. Both the line
        // count and a real line's cents are hand-typed, so a "control" that
        // silently started refusing (and therefore produced no lines to
        // check) cannot pass this.
        controlTheSameReturnBelowTheThresholdComputesSilently: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
                }))([w2WithMedicareWages('sha256-w2-ordinary')('150000.00')])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['a box 5 below the threshold must compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            assertEq(outcome.lines.length, expectedWholeReportLineCount)
            assertEq(lineRuled(outcome.lines)('1040 line 1a').value, 15000000n, '$150,000.00, hand-typed')
            for (const line of outcome.lines) {
                assert(
                    !line.rule.includes('8959'),
                    ['a silent return must not mention Form 8959 anywhere', line.rule])
            }
        },
        // CRITERION 1, the half a shape assertion cannot reach: the tripwire
        // is evaluated BEFORE any line computes.
        //
        // Proven by racing it against a refusal that can only arise DURING
        // line computation — Schedule D's absent-basis refusal, which needs
        // Form 8949 to have been assembled. The same inputs that produce that
        // refusal, plus one $300,000 W-2, must come back with the TRIPWIRE's
        // refusal instead. If the tripwire ran after the lines, the
        // absent-basis message would win, because it is raised first in
        // `computeForm1040`'s own order.
        //
        // Distinguished BY MECHANISM rather than by `kind === 'error'`, the
        // same discipline `absentBasisRefusesTheWholeIncomeLinesCallBeforeAnyLineIsBuilt`
        // records: the absent-basis arm refuses with an EMPTY `unmodeled` and
        // a message naming the missing box; this one names a kind and a form.
        theTripwireIsEvaluatedBeforeAnyLineComputes: () => {
            const absentBasisForm = brokerageDocument('sha256-b-absent-basis-tripwire')({
                box1dProceeds: '10000.00',
                box2LongTermGainOrLoss: true,
                box5NoncoveredSecurity: true,
                // box1eCostOrOtherBasis genuinely OMITTED.
            })
            const racedOutcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))(
                    [w2WithMedicareWages('sha256-w2-race')('300000.00')])([])([])([absentBasisForm])([])([])([])([])([]))
            assert(racedOutcome.kind === 'error', ['expected a refusal', racedOutcome])
            if (racedOutcome.kind !== 'error') {
                return
            }
            assertEq(
                racedOutcome.unmodeled[0],
                'additionalMedicareTax',
                ['the tripwire must win the race against a line-computation refusal', racedOutcome.unmodeled])
            assert(
                racedOutcome.message.includes('Form 8959'),
                ['expected the tripwire refusal, not the absent-basis one', racedOutcome.message])
            assert(
                !racedOutcome.message.includes('box1eCostOrOtherBasis'),
                ['no line may be computed once a tripwire has fired', racedOutcome.message])
            // THE CONTROL that makes the race real: the identical inputs
            // WITHOUT the $300,000 W-2 do reach line computation and do come
            // back with the absent-basis refusal. Without this half, the
            // assertions above would pass even if Schedule D had quietly
            // stopped refusing at all.
            const unracedOutcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])([])([absentBasisForm])([])([])([])([])([]))
            assert(unracedOutcome.kind === 'error', ['expected the absent-basis refusal', unracedOutcome])
            if (unracedOutcome.kind !== 'error') {
                return
            }
            assertEq(unracedOutcome.unmodeled.length, 0, ['the absent-basis arm names no kind', unracedOutcome.unmodeled])
            assert(
                unracedOutcome.message.includes('box1eCostOrOtherBasis is genuinely absent'),
                ['expected the absent-basis message when no tripwire fires', unracedOutcome.message])
        },
        // The documented ORDER of the two guards, pinned. A return that
        // declares an unmodeled kind AND trips a tripwire refuses either way,
        // so which sentence it gets is a decision rather than an accident —
        // and the one naming what the taxpayer THEMSELVES wrote down is the
        // one they can act on first. This is also what keeps every refusal
        // message that existed before this phase byte-identical.
        theDeclaredScopeGuardStillRunsFirstWhenBothWouldRefuse: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'unreportedTips'],
                }))([w2WithMedicareWages('sha256-w2-both')('300000.00')])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assert(
                outcome.message.includes('this return declares'),
                ['the declared-scope guard runs first', outcome.message])
            assertEq(outcome.unmodeled[0], 'unreportedTips', ['expected the DECLARED kind named', outcome.unmodeled])
            assert(
                !outcome.message.includes('the supplied documents require'),
                ['only one of the two guards may speak', outcome.message])
        },
    },
    // ── Phase 23 (TAX-20/TAX-21): Schedule 2 lines 11 and 12, END TO END ──
    //
    // Every leaf here goes through `form1040Report`, the real entry point,
    // rather than through `fjs/schedule/2` or the two form modules directly.
    // That is the difference between "the arithmetic is right" and "the
    // arithmetic reaches the return", and only the second is what the
    // FAANG-engineer persona was blocked on.
    scheduleTwoPopulated: {
        // **THE PHASE'S WHOLE POINT, and the other half of Phase 22's
        // tripwire pair.** `computableTripwires.aThreeHundredThousandDollarBoxFive...`
        // above proves an UNDECLARED $300,000 box 5 still refuses; this
        // proves the SAME return, with `additionalMedicareTax` declared,
        // COMPUTES. Both directions, one phase, and the tripwire's remedy
        // ("declare it and this engine computes Form 8959") is now true.
        //
        // Every figure hand-computed from the printed forms, in order:
        //   box 1 = box 5 = $300,000.00, box 2 = $60,000.00
        //   box 6 = 1.45% of $300,000 ($4,350.00) + 0.9% of the $100,000 this
        //           ONE employer paid above $200,000 ($900.00) = $5,250.00
        //   line 12e = $15,750.00, single's TY2025 standard deduction
        //   line 15  = $300,000.00 - $15,750.00 = $284,250.00
        //   line 16, the Tax Computation Worksheet over single's brackets:
        //       10% x  11,925.00            =  1,192.50
        //       12% x ( 48,475 -  11,925)   =  4,386.00
        //       22% x (103,350 -  48,475)   = 12,072.50
        //       24% x (197,300 - 103,350)   = 22,548.00
        //       32% x (250,525 - 197,300)   = 17,032.00
        //       35% x (284,250 - 250,525)   = 11,803.75
        //                                     ---------
        //                                     69,034.75
        //   line 23  = Form 8959 line 18 = 0.9% x $100,000.00 =    $900.00
        //   line 24  = $69,034.75 + $900.00                   = $69,934.75
        //   line 25c = Form 8959 line 24 = $5,250.00 - $4,350.00 = $900.00
        //   line 33  = $60,000.00 + $900.00                   = $60,900.00
        //   line 37  = $69,934.75 - $60,900.00                 = $9,034.75
        theFaangReturnComputesInsteadOfRefusing: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'federalTaxWithheldOnW2', 'additionalMedicareTax'],
                }))([{
                    ...w2WithMedicareBoxes('sha256-w2-faang-computes')('300000.00')('5250.00'),
                    value: {
                        ...w2WithMedicareBoxes('sha256-w2-faang-computes')('300000.00')('5250.00').value,
                        box2FederalIncomeTaxWithheld: '60000.00',
                    },
                }])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['a declared $300,000 box 5 must COMPUTE, not refuse', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            assertEq(outcome.lines.length, expectedWholeReportLineCount)
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 1a').value, 30000000n, '$300,000.00')
            assertEq(at('1040 line 15').value, 28425000n, '$284,250.00')
            assertEq(at('1040 line 16').value, 6903475n, '$69,034.75, hand-computed over single\'s brackets')
            assertEq(at('1040 line 17').value, 0n, '$0.00 — Schedule 2 Part I is untouched by either new tax')
            assertEq(at('1040 line 23').value, 90000n, '$900.00 — Schedule 2 line 11, through Part II\'s own total')
            assertEq(at('1040 line 24').value, 6993475n, '$69,934.75')
            assertEq(at('1040 line 25a').value, 6000000n, '$60,000.00 of box 2 withholding')
            assertEq(at('1040 line 25c').value, 90000n, '$900.00 — Form 8959 line 24, already withheld in box 6')
            assertEq(at('1040 line 33').value, 6090000n, '$60,900.00 of total payments')
            assertEq(at('1040 line 37').value, 903475n, '$9,034.75 owed')
        },
        // …and line 23 really does arrive THROUGH Schedule 2's own Part II
        // total rather than by a side channel. Criterion 1's own words. Line
        // 23's `sources` are Schedule 2 line 21's, which unions every addend
        // it summed — so the W-2 box 5 that produced line 11 must be citable
        // from 1040 line 23 itself.
        lineTwentyThreeArrivesThroughScheduleTwosOwnPartTwoTotal: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'additionalMedicareTax'],
                }))([w2WithMedicareBoxes('sha256-w2-through-sch2')('300000.00')('5250.00')])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const line23 = lineRuled(outcome.lines)('1040 line 23')
            assertEq(line23.value, 90000n, '$900.00')
            const boxes = line23.sources.map(source => source.boxPath)
            assert(
                boxes.includes('box5MedicareWagesAndTips'),
                ['1040 line 23 must be able to cite the box that produced it', boxes])
            // …and it still cites the profile, because twelve of Schedule 2's
            // fourteen kinds are still declared zeros summed into the same
            // total. A line 23 that had stopped citing `declaredKinds` would
            // mean those twelve had silently left the sum.
            assert(
                boxes.includes('declaredKinds'),
                ['1040 line 23 must still cite the twelve declared zeros it also sums', boxes])
        },
        // **THE CASE WHERE THE FILER ACTUALLY OWES.** A joint couple with two
        // $150,000 employers: NEITHER employer paid anyone above $200,000, so
        // neither withheld a cent of Additional Medicare Tax, yet the couple
        // is $50,000 over the $250,000 joint threshold. This is the return
        // where the phase changes the bottom line rather than merely the
        // presentation, and its control is the identical return with the two
        // Medicare boxes absent.
        //
        // Hand-computed:
        //   box 5 total = $300,000.00; box 6 total = 1.45% of it = $4,350.00
        //   line 12e = $31,500.00, the MFJ standard deduction
        //   line 15  = $300,000.00 - $31,500.00 = $268,500.00
        //   line 16, over MFJ's brackets:
        //       10% x  23,850.00            =  2,385.00
        //       12% x ( 96,950 -  23,850)   =  8,772.00
        //       22% x (206,700 -  96,950)   = 24,145.00
        //       24% x (268,500 - 206,700)   = 14,832.00
        //                                     ---------
        //                                     50,134.00
        //   line 23  = 0.9% x ($300,000 - $250,000) = $450.00
        //   line 25c = $4,350.00 - 1.45% x $300,000 = $0.00, floored
        //   line 37  = $50,134.00 + $450.00 = $50,584.00
        twoEmployersBelowTheThresholdMakeAJointCoupleOweFourHundredAndFifty: () => {
            /** @type {(declaredKinds: readonly Kind[]) => (w2s: readonly Stored<W2>[]) => Form1040Outcome} */
            const jointReturn = declaredKinds => w2s => form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    filingStatus: 'marriedFilingJointly',
                    declaredKinds,
                }))(w2s)([])([])([])([])([])([])([])([]))

            const outcome = jointReturn(['wages', 'additionalMedicareTax'])([
                w2WithMedicareBoxes('sha256-w2-mfj-a')('150000.00')('2175.00'),
                w2WithMedicareBoxes('sha256-w2-mfj-b')('150000.00')('2175.00'),
            ])
            assert(outcome.kind === 'ok', ['expected the joint return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 16').value, 5013400n, '$50,134.00, hand-computed over MFJ\'s brackets')
            assertEq(at('1040 line 23').value, 45000n, '$450.00 — 0.9% of the $50,000 over $250,000')
            assertEq(at('1040 line 25c').value, 0n, '$0.00 — neither employer withheld any of it')
            assertEq(at('1040 line 37').value, 5058400n, '$50,584.00 owed')

            // THE CONTROL, and it is what prices the phase: the identical
            // wages with NO box 5 or box 6 — the shape every fixture in this
            // repository had before Phase 23 — owes $450.00 LESS, and that
            // $450.00 is exactly the understatement this phase closes.
            const control = jointReturn(['wages'])([
                w2Document('sha256-w2-mfj-control-a')('150000.00'),
                w2Document('sha256-w2-mfj-control-b')('150000.00'),
            ])
            assert(control.kind === 'ok', ['expected the control return to compute', control])
            if (control.kind !== 'ok') {
                return
            }
            const controlAt = lineRuled(control.lines)
            assertEq(controlAt('1040 line 16').value, 5013400n, 'the same $50,134.00 of ordinary tax')
            assertEq(controlAt('1040 line 23').value, 0n, '$0.00 — no Medicare wages were supplied')
            assertEq(controlAt('1040 line 37').value, 5013400n, '$50,134.00 owed, $450.00 less')
        },
        // **THE REGRESSION CONTROL, and it matters more than either gate.** A
        // return BELOW every threshold computes exactly what it computed
        // before this phase: line 23 and line 25c both $0.00, on a return
        // that carries real Medicare boxes. Paired with a hand-typed line 37
        // so a "control" that had quietly started refusing — and therefore
        // produced no lines to check — cannot pass.
        //
        // Hand-computed: $150,000.00 of wages — comfortably below every one of
        // the five §3101(b)(2) thresholds and every one of the five §1411(b)
        // ones — standard deduction $15,750.00, taxable income $134,250.00,
        // and over single's brackets
        //       10% x  11,925.00           =  1,192.50
        //       12% x ( 48,475 -  11,925)  =  4,386.00
        //       22% x (103,350 -  48,475)  = 12,072.50
        //       24% x (134,250 - 103,350)  =  7,416.00
        //                                    ---------
        //                                    25,067.00
        // with $30,000.00 withheld, so $4,933.00 is refunded on line 34.
        //
        // Taxable income ABOVE $100,000 on purpose: below it, line 16 comes
        // off the printed Tax Table, which taxes the MIDPOINT of a $50 band
        // and rounds the result to a whole dollar, so straight bracket
        // arithmetic is the wrong method and would be a hand-computed
        // expectation of something this leaf is not testing. (Learned by
        // writing this leaf at $50,000 first: $34,250 of taxable income is
        // $3,875.00 off the table, not the $3,871.50 the brackets give.)
        anOrdinaryWageEarnerBelowEveryThresholdIsUnchanged: () => {
            const w2 = w2WithMedicareBoxes('sha256-w2-ordinary-both-boxes')('150000.00')('2175.00')
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'federalTaxWithheldOnW2'],
                }))([{
                    ...w2,
                    value: { ...w2.value, box2FederalIncomeTaxWithheld: '30000.00' },
                }])([])([])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['an ordinary wage earner must still compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            // Box 6 here is EXACTLY 1.45% of box 5 ($150,000 x 0.0145 =
            // $2,175.00), which is what an employer under the threshold
            // really prints -- so Part V line 22 subtracts to exactly zero,
            // and the FLOOR is not what produces the zero. That distinction
            // is why this leaf carries a real box 6 rather than omitting it.
            assertEq(at('1040 line 23').value, 0n, '$0.00 — nothing on Schedule 2')
            assertEq(at('1040 line 25c').value, 0n, '$0.00 — box 6 is exactly the ordinary 1.45%')
            assertEq(at('1040 line 16').value, 2506700n, '$25,067.00, hand-computed')
            assertEq(at('1040 line 34').value, 493300n, '$4,933.00 refunded')
        },
        // THE BOUNDARY PAIR at the report, and one cent is what it costs.
        // "In excess of" is the statute's own word, so exactly AT $200,000
        // there is no tax; 56 cents above, 0.9% first rounds up to a cent
        // (0.9% of 56 cents = 0.504 cents). The middle probe, one cent above,
        // is what shows the RATE rather than the comparison is why line 23 is
        // still zero there.
        theBoundaryPairAtTheReport: () => {
            /** @type {(boxFive: string) => bigint} */
            const lineTwentyThreeAt = boxFive => {
                const outcome = form1040Report(taxParams2025)(
                    inputsOf(storedProfile({
                        ...singleProfile,
                        declaredKinds: ['wages', 'additionalMedicareTax'],
                    }))([w2WithMedicareWages('sha256-w2-boundary')(boxFive)])([])([])([])([])([])([])([])([]))
                assert(outcome.kind === 'ok', ['the boundary probe must compute', boxFive, outcome])
                if (outcome.kind !== 'ok') {
                    return -1n
                }
                return lineRuled(outcome.lines)('1040 line 23').value
            }
            assertEq(lineTwentyThreeAt('200000.00'), 0n, 'exactly AT the threshold is not "in excess of" it')
            assertEq(lineTwentyThreeAt('200000.01'), 0n, 'one cent above: 0.9% of a cent rounds to $0.00')
            assertEq(lineTwentyThreeAt('200000.56'), 1n, '$0.01 — 0.9% of 56 cents rounds up to one cent')
        },
        // **FORM 8960, END TO END.** A filer with no wages at all and
        // $300,000 of taxable interest: §1411's threshold is $200,000, the
        // excess is $100,000, the net investment income is $300,000, and the
        // SMALLER of the two is taxed at 3.8% = $3,800.00. Hand-computed.
        //
        // No tripwire watches §1411, so this return would have computed
        // silently and $3,800.00 short before this phase — the mirror image
        // of the Additional Medicare Tax gap Phase 22 found, closed by
        // COMPUTING rather than by refusing.
        netInvestmentIncomeTaxReachesLineTwentyThree: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['taxableInterest', 'netInvestmentIncomeTax'],
                }))([])([interestDocument('sha256-int-niit')({ box1InterestIncome: '300000.00' })])(
                    [])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the investor\'s return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 2b').value, 30000000n, '$300,000.00 of taxable interest')
            assertEq(at('1040 line 11b').value, 30000000n, '$300,000.00 of AGI')
            assertEq(at('1040 line 23').value, 380000n, '$3,800.00 — 3.8% of the $100,000 excess')
            assertEq(at('1040 line 25c').value, 0n, '$0.00 — no W-2, so no Form 8959 withholding')
        },
        // **THE EXCLUSIONS, END TO END, and this is the leaf that would catch
        // an over-inclusion.** The SAME $300,000 of adjusted gross income and
        // the SAME §1411 threshold — but made of an IRA distribution rather
        // than interest, with $50,000 of tax-exempt interest beside it. Net
        // investment income is $0.00, so the tax is $0.00:
        //
        // - §1411(c)(5) excludes distributions from §408 plans, so the
        //   1099-R's $300,000 is not net investment income even though it IS
        //   in AGI and does put the filer over the threshold;
        // - §103(a) keeps the $50,000 of tax-exempt interest out of gross
        //   income entirely, so it is neither in AGI nor in Part I.
        //
        // Getting either exclusion wrong overstates the tax silently:
        // counting the IRA distribution would charge $3,800.00 and counting
        // the municipal interest would charge $1,900.00, on a return that
        // owes neither. The control is the leaf immediately above, where
        // $300,000 of the RIGHT kind of income does produce $3,800.00.
        theExclusionsHoldEndToEnd: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['taxExemptInterest', 'iraDistributions', 'netInvestmentIncomeTax'],
                }))([])([interestDocument('sha256-int-exempt')({ box8TaxExemptInterest: '50000.00' })])(
                    [])([])([retirementDocument('sha256-r-niit')({
                        box1GrossDistribution: '300000.00',
                        box2aTaxableAmount: '300000.00',
                        box7bIraSepSimple: true,
                    })])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the retiree\'s return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 2a').value, 5000000n, '$50,000.00 of tax-exempt interest, reported')
            assertEq(at('1040 line 2b').value, 0n, '$0.00 of TAXABLE interest')
            assertEq(at('1040 line 4b').value, 30000000n, '$300,000.00 of taxable IRA distribution')
            assertEq(at('1040 line 11b').value, 30000000n, '$300,000.00 of AGI — over §1411\'s $200,000')
            assertEq(at('1040 line 23').value, 0n, '$0.00 — neither exclusion is net investment income')
        },
        // **THE §1411 QUALIFYING-SURVIVING-SPOUSE TRAP, END TO END**, against
        // the head-of-household control that tells the two statutes apart.
        // $240,000 of AGI, all of it taxable interest:
        //   - QSS falls under §1411(b)(1)'s "or a surviving spouse (as
        //     defined in section 2(a))" clause and gets the JOINT $250,000,
        //     so there is no excess and no tax;
        //   - head of household gets §1411(b)(3)'s $200,000, so $40,000 is in
        //     excess and 3.8% of it is $1,520.00.
        // Had `fjs/form8960` read Form 8959's §3101(b)(2) threshold — where a
        // QSS filer gets $200,000 — the first half would charge $1,520.00 too.
        aQualifyingSurvivingSpouseGetsTheJointNiitThreshold: () => {
            /** @type {(filingStatus: string) => bigint} */
            const lineTwentyThreeFor = filingStatus => {
                const outcome = form1040Report(taxParams2025)(
                    inputsOf(storedProfile({
                        ...singleProfile,
                        filingStatus,
                        declaredKinds: ['taxableInterest', 'netInvestmentIncomeTax'],
                    }))([])([interestDocument('sha256-int-qss')({ box1InterestIncome: '240000.00' })])(
                        [])([])([])([])([])([])([]))
                assert(outcome.kind === 'ok', ['expected the return to compute', filingStatus, outcome])
                if (outcome.kind !== 'ok') {
                    return -1n
                }
                return lineRuled(outcome.lines)('1040 line 23').value
            }
            assertEq(lineTwentyThreeFor('qualifyingSurvivingSpouse'), 0n, '$240,000 is below §1411(b)(1)\'s $250,000')
            assertEq(lineTwentyThreeFor('headOfHousehold'), 152000n, '$1,520.00 — 3.8% of the $40,000 excess')
        },
        // BOTH taxes on ONE return, added rather than one replacing the
        // other: $900.00 of Additional Medicare Tax on $300,000 of wages plus
        // 3.8% on the smaller of $100,000 of investment income and the
        // $200,000 of excess income = $3,800.00, so line 23 is $4,700.00.
        // Hand-added.
        //   AGI = $300,000 wages + $100,000 interest = $400,000.00
        //   §1411 excess = $400,000 - $200,000 = $200,000.00
        //   net investment income = $100,000.00, the smaller
        //   3.8% x $100,000.00 = $3,800.00; 0.9% x $100,000.00 = $900.00
        bothTaxesOnOneReturnAddIntoLineTwentyThree: () => {
            const outcome = form1040Report(taxParams2025)(
                inputsOf(storedProfile({
                    ...singleProfile,
                    declaredKinds: ['wages', 'taxableInterest', 'additionalMedicareTax', 'netInvestmentIncomeTax'],
                }))([w2WithMedicareBoxes('sha256-w2-both-taxes')('300000.00')('5250.00')])(
                    [interestDocument('sha256-int-both-taxes')({ box1InterestIncome: '100000.00' })])(
                    [])([])([])([])([])([])([]))
            assert(outcome.kind === 'ok', ['expected the return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 11b').value, 40000000n, '$400,000.00 of AGI')
            assertEq(at('1040 line 23').value, 470000n, '$4,700.00 = $900.00 + $3,800.00')
            assertEq(at('1040 line 25c').value, 90000n, '$900.00 of Additional Medicare Tax already withheld')
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
            inputsOf(profile)([])(tenInterestDocumentsAtOneThirtyNine)([])([])([])([])([])([])([])))
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
                        inputsOf(profile)([])([document])([])([])([])([])([])([])([]))).line2b,
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
            inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([])))
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
            ])([])([dividendForm])([])([])([])([])([])([])
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
            ])([])([dividendForm])([])([])([])([])([])([])
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
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])([])([brokerageForm])([])([])([])([])([])
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
                [dividendForm])([brokerageForm])([])([])([])([])([])
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
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))([])([])([])([absentBasisForm])([])([])([])([])([])
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
    // TAX-17/Plan 15-05: the carryover reachability proof (T-15-09/T-15-10)
    // — a prior-year capital loss carries into the current year's Schedule D
    // lines 6/14 through the SAME entry point every other line uses, not
    // merely through `scheduleD` called in isolation.
    priorYearCapitalLossCarryover: {
        // A full return: brokerage sales, `capitalGainsOrLosses` declared,
        // and ONE stored carryover document carrying Plan 15-02's Worked
        // Example B figures (ST loss $10,000.00, LT gain $1,000.00, line21
        // -$3,000.00, Form1040 line15 +$20,000.00) — independently
        // hand-computed by `fjs/tax/carryover/module.f.js`'s own worked
        // example to a $6,000.00 short-term carryover, and by
        // `fjs/schedule/d`'s own Task 1 proof to `line6 === -600000n`.
        // Reached through `form1040IncomeLines` at the TOP-LEVEL entry
        // point — never through a direct `scheduleD(...)` call — mirroring
        // this file's own established wiring-check idiom
        // (`cleanGainDeclaredScheduleDWiresLineSevenAAndTheFourDispatcherFields`
        // above): `outcome.scheduleD16Cents` (the only Schedule D total this
        // typedef exposes) is compared against an INDEPENDENT `scheduleD`
        // call fed the SAME documents, including the SAME carryover — if
        // `capitalLossCarryoverForms` were ever dropped on the way into
        // `scheduleD`, `outcome.scheduleD16Cents` would be $6,000.00 higher
        // than `independentScheduleD.line16` and this assertion would fail.
        carryoverReachesScheduleDThroughTheFullIncomeLinesEntryPoint: () => {
            const brokerageForm = brokerageDocument('sha256-b-carryover-reachability')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            /** @type {Stored<PriorYearCapitalLoss>} */
            const carryoverDoc = {
                documentHash: 'sha256-carryover-worked-example-b',
                value: {
                    dialect: 'vnd.fjs.prior_year_capital_loss',
                    recipientTin: '222-22-2222',
                    taxYear: 2024,
                    priorYearFormLine15: '20000.00',
                    priorYearScheduleDLine7: '-10000.00',
                    priorYearScheduleDLine15: '1000.00',
                    priorYearScheduleDLine21: '-3000.00',
                },
            }
            const inputs = inputsOf(storedProfile(declaringCapitalGainsOrLossesProfile))
                ([])([])([])([brokerageForm])([])([])([])([])([carryoverDoc])
            const outcome = form1040IncomeLines(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the income lines to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(outcome.filingScheduleD, true, 'the declared kind must select Schedule D')
            const independentScheduleD = scheduleD({
                status: 'single',
                brokerageForms: [brokerageForm],
                dividendForms: [],
                priorYearCapitalLossCarryover: carryoverDoc,
            })
            assert(independentScheduleD.kind === 'ok', ['expected Schedule D to compute', independentScheduleD])
            if (independentScheduleD.kind !== 'ok') {
                throw ['expected ok', independentScheduleD]
            }
            // The reachable-path assertion this criterion requires — the
            // SAME independently hand-computed figure Plan 15-02's own
            // worked example and this plan's Task 1 both establish, read
            // off the Schedule D outcome that fed the SAME inputs the
            // full-return call above used.
            assertEq(independentScheduleD.line6, -600000n, '$6,000.00 short-term carryover, entered as a negative')
            // The WIRING check: `form1040IncomeLines`'s own Schedule D total
            // must match the carryover-inclusive independent computation —
            // this is what a dropped `capitalLossCarryoverForms` argument
            // would break.
            assertEq(
                outcome.scheduleD16Cents,
                independentScheduleD.line16,
                'form1040IncomeLines must have threaded the SAME carryover-inclusive Schedule D result',
            )
        },
    },
    // TAX-17/Plan 15-05: "any year with parameters and documents computes"
    // proven STRUCTURALLY — the SAME fixture return
    // (`singleWithNoCheckedBoxesIsFifteenSevenFiftyCitingFilingStatusAlone`
    // proves it against TY2025) computed against a SECOND, synthetic
    // `TaxParamSet` produces the SYNTHETIC set's own doubled figure, never
    // TY2025's, proving `form1040IncomeLines` genuinely dispatches on its
    // `taxParamSet` argument rather than a hardcoded year.
    yearGenericity: {
        syntheticSecondTaxParamSetDrivesLineTwelveEWithItsOwnFigures: () => {
            const inputs = inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([])
            const outcome = expectIncomeOk(form1040IncomeLines(syntheticTaxParamSetForGenericityProof)(inputs))
            // $31,500.00 — the SYNTHETIC set's own doubled figure, hand-typed
            // here (never read back off `syntheticTaxParamSetForGenericityProof`
            // itself, and never TY2025's $15,750.00).
            assertEq(
                outcome.line12e.value,
                3150000n,
                'the synthetic set doubles TY2025\'s $15,750.00 standard deduction to $31,500.00',
            )
            assertEq(outcome.line12e.sources.length, 1)
            const [only] = outcome.line12e.sources
            assertEq(only?.boxPath, 'filingStatus')
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([iraForm, pensionForm])([ssaForm])([])([])([])))
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
        // line25b now sums FIVE document types: 1099-INT, 1099-R, 1099-DIV,
        // 1099-B and 1099-G, each `box4FederalIncomeTaxWithheld` — matching
        // `federalTaxWithheldOnOther1099`'s own remedy string
        // (`fjs/return/scope`). $10 + $100 + $50 + $25 + $20 = $205.00,
        // hand-typed, never re-derived from the code under test.
        //
        // **This leaf said FOUR, and tested four, for a day after line 25b
        // began summing five.** Phase 20 added the 1099-G term and its own
        // dedicated leaf, but left the leaf whose entire job is to assert the
        // COMPLETE set still asserting the old set — and green, because four
        // of five summing correctly is a true statement about a subset. It is
        // the same defect as the hand-typed modeled-kind list in
        // `fjs/return/scope`, on the same day, from the same commit.
        line25bSumsAllFiveWithholdingDocumentTypes: () => {
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
            const unemploymentForm = unemploymentDocument('sha256-1099g-wh')('0.00')('20.00')
            const { tax } = computedLines(withUnemployment(
                inputsOf(storedProfile(singleProfile))([])([interestForm])([dividendForm])([brokerageForm])(
                    [retirementForm])([])([])([])([]))([unemploymentForm]))
            assertEq(tax.line25b.value, 20500n, '$205.00 across all five document types')
            assertEq(tax.line25b.sources.length, 5)
        },
        // The IRA-deduction circularity refusal (Decision 3.3/5.1): a
        // profile declaring `iraDeductionDeclared: true` refuses the WHOLE
        // return, naming Pub. 590-A, with an EMPTY `unmodeled` list — a
        // document-data-sufficiency refusal (12.1-CONTEXT.md Decision 2.6),
        // never a `fjs/return/scope` kind.
        iraDeductionDeclaredRefusesNamingPub590ABeforeTheWorksheetRuns: () => {
            const outcome = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile({ ...singleProfile, iraDeductionDeclared: true }))(
                    [])([])([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(singleProfile))([])([])([])([])([])([])([])([])([]))
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
                    [])([])([])([])([])([])([])([])([]))
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
            }))([])([])([])([])([iraForm, pensionForm])([])([])([])([]))
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
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([])))
            assertEq(lines.line11b.value, 8000000n, '$80,000.00 AGI -- wages alone')
            assertEq(lines.line13b.value, 570000n, '$5,700.00, Schedule 1-A\'s own $80,000 AGI fixture')
            // WR-03 (13-REVIEW.md): line13b's value depends on `status`
            // (which threshold, and the MFS short-circuit) and on the
            // CHECKED age box (which of line36a/line36b is nonzero) -- not
            // merely on AGI. This assertion is REWRITTEN, not weakened
            // (AGENTS.md): the fix legitimately widens line13b's sources
            // beyond line11b's own, so the old "cites the SAME sources as
            // line11b" claim is no longer true, and the replacement checks
            // for MORE provenance, not less.
            assertEq(
                lines.line13b.sources.length,
                1 /* filingStatusSource */ + 1 /* the checked taxpayerBornBeforeJan2_1961 box */
                    + lines.line11b.sources.length /* AGI's own provenance */,
                'cites the filing-status box AND the checked age box IN ADDITION TO AGI\'s own provenance',
            )
            assert(
                lines.line13b.sources.some(source => source.boxPath === 'filingStatus'),
                ['expected line13b to cite the filing-status box (Decision 5.4\'s MFS short-circuit)', lines.line13b.sources],
            )
            assert(
                lines.line13b.sources.some(source => source.boxPath === 'taxpayerBornBeforeJan2_1961'),
                ['expected line13b to cite the checked age box driving line36a', lines.line13b.sources],
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
            }))([w2Form])([])([])([])([])([])([])([])([]))
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
            }))([])([])([])([])([])([])([])([])([]))
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([])
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
                // Credit Limit Worksheet A line 2: this fixture claims no
                // Schedule 3 credit, so the ordering this input expresses
                // subtracts nothing — which is what makes the cross-check an
                // independent re-derivation rather than a copy.
                scheduleThreeCreditsCents: 0n,
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([])
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
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([]))
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
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([]))
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
                [iraForm, pensionForm])([ssaForm])([])([])([])
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
            const inputs = inputsOf(storedProfile(profile))([])([])([])([])([iraForm])([ssaForm])([])([])([])
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([])
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([])
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])([])
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
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])([])
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
    // WR-02 (13-REVIEW.md): Decision 2.2's withholding-drift check, now
    // wired into `scheduleA`'s real computation, exercised through the FULL
    // `form1040Report(...)` entry point — a genuinely too-low asserted
    // `saltIncomeTax` entry sitting next to a W-2 whose `stateIncomeTax` box
    // shows more was withheld must refuse the WHOLE return, not compute
    // silently.
    wr02SaltWithholdingDriftWholeReturn: {
        understatedSaltIncomeTaxNextToARealW2RefusesTheWholeReturn: () => {
            const w2Form = {
                ...w2Document('sha256-w5-drift-w2')('90000.00'),
                value: {
                    ...w2Document('sha256-w5-drift-w2')('90000.00').value,
                    box15Through20: [{ state: 'CA', stateIncomeTax: '4200.00' }],
                },
            }
            const itemizedForm = itemizedDeductionsDocument('sha256-w5-drift-itemized')([
                // Asserted $1,000.00 -- genuinely BELOW the $4,200.00 CA
                // withholding this SAME return's own W-2 already reports.
                { lineTag: 'saltIncomeTax', amount: '1000.00' },
            ])
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: ['wages', 'itemizedDeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assertEq(outcome.kind, 'error', 'expected the whole return to refuse on the withholding drift')
            if (outcome.kind === 'error') {
                assert(
                    outcome.message.includes('asserted') && outcome.message.includes('storedWithholding'),
                    ['expected the refusal to name the withholding drift', outcome.message],
                )
                assertEq(outcome.unmodeled.length, 0, 'a data-sufficiency refusal, never a fjs/return/scope kind')
            }
        },
        // The control: the SAME W-2, with the asserted SALT income tax
        // raised to cover the withholding, computes the WHOLE return
        // normally -- proving the wiring refuses the drift specifically,
        // not every return that carries a W-2 alongside itemized SALT.
        consistentSaltIncomeTaxNextToTheSameW2ComputesNormally: () => {
            const w2Form = {
                ...w2Document('sha256-w5-nodrift-w2')('90000.00'),
                value: {
                    ...w2Document('sha256-w5-nodrift-w2')('90000.00').value,
                    box15Through20: [{ state: 'CA', stateIncomeTax: '4200.00' }],
                },
            }
            const itemizedForm = itemizedDeductionsDocument('sha256-w5-nodrift-itemized')([
                { lineTag: 'saltIncomeTax', amount: '5000.00' },
            ])
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: ['wages', 'itemizedDeductions'],
            }
            const inputs = inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([itemizedForm])([])([])
            const outcome = form1040Report(taxParams2025)(inputs)
            assert(outcome.kind === 'ok', ['expected the consistent return to compute, not refuse', outcome])
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
                inputsOf(storedProfile(profile))([w2Form])([])([])([])([])([])([])([])([]))
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

            // WR-03 (13-REVIEW.md): both lines are PRIMARILY determined by
            // the profile's own `dependents` array -- an auditor inspecting
            // either line's sources must see it was consulted.
            assert(
                line19.sources.some(source => source.boxPath === 'dependents'),
                ['expected line19 to cite the dependents array', line19.sources],
            )
            assert(
                line28.sources.some(source => source.boxPath === 'dependents'),
                ['expected line28 to cite the dependents array', line28.sources],
            )

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
                // See the sibling cross-check above: this fixture claims no
                // Schedule 3 credit, so Credit Limit Worksheet A line 2 is
                // zero and the re-derivation stays independent.
                scheduleThreeCreditsCents: 0n,
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
            }))([w2Document('sha256-t10-wave4-cliff-at')('400000.00')])([])([])([])([])([])([])([])([]))
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
            }))([w2Document('sha256-t10-wave4-cliff-over')('400000.01')])([])([])([])([])([])([])([])([]))
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
            ])([])([dividendForm])([brokerageForm])([])([])([])([])([])

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
                [iraForm])([ssaForm])([itemizedForm])([])([])
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
                // See the sibling cross-check above: this fixture claims no
                // Schedule 3 credit, so Credit Limit Worksheet A line 2 is
                // zero and the re-derivation stays independent.
                scheduleThreeCreditsCents: 0n,
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
    // ── Phase 24 (TAX-23/TAX-24/DOC-19): Schedule 1 Part II, end to end ─────
    //
    // The persona this phase exists for. Until this phase a non-profit
    // employee's return COMPUTED — completely, confidently, with every line
    // cited — and OVERSTATED the tax, because every Schedule 1 adjustment was
    // a hard zero rather than a refusal. Nothing in the return said so.
    //
    // These leaves run the whole `form1040Report` entry point, so they prove
    // the thing the unit proofs in `fjs/schedule/1` cannot: that lines 11, 13
    // and 21 reach 1040 line 10 **through Schedule 1's own Part II total**
    // and go on to move AGI and taxable income.
    // ── Phase 25 (TAX-25/TAX-26): Schedule 3's credits, end to end ─────────
    //
    // These leaves run the whole `form1040Report` entry point, so they prove
    // what `fjs/schedule/3`'s unit proofs cannot: that the two credits reach
    // 1040 line 20 **through Schedule 3's own Part I total**, that the
    // refundable American Opportunity Credit reaches 1040 line 29 WITHOUT
    // passing through Schedule 3 at all, and that both then move the amount
    // owed.
    //
    // Every figure below is hand-derived from the printed forms, in order,
    // and none of it is read back from the code under test:
    //
    //   1040 line 1a/1z = W-2 box 1                            $39,000.00
    //   1040 line 9  (total income)                            $39,000.00
    //   1040 line 11 (AGI; Schedule 1 is all zeros)            $39,000.00
    //   1040 line 12 (standard deduction, single TY2025)       $15,750.00
    //   1040 line 15 (taxable income)                          $23,250.00
    //   1040 line 16: the printed Tax Table, NOT bracket arithmetic. The
    //       $50-wide band [$23,250, $23,300) has midpoint $23,275.00, taxed
    //       at 10% of the first $11,925.00 = $1,192.50 plus 12% of the
    //       remaining $11,350.00 = $1,362.00, i.e. $2,554.50, rounded to the
    //       nearest DOLLAR                                      $2,555.00
    //   1040 line 18 (line 16 + Schedule 2 Part I $0.00)        $2,555.00
    //
    //   Form 8863 Part III: line 27 = min($9,000.00, $4,000.00) = $4,000.00;
    //       line 28 = $2,000.00; line 29 = 25% = $500.00; line 30 = $2,500.00
    //   Form 8863 Part I: line 1 = $2,500.00; line 2 = $90,000.00; line 3 =
    //       $39,000.00; line 4 = $51,000.00, which exceeds line 5's
    //       $10,000.00, so line 6 = 1.000; line 7 = $2,500.00; line 8 = 40%
    //       = $1,000.00 -> 1040 line 29; line 9 = $1,500.00
    //   Form 8863's Credit Limit Worksheet: $2,555.00 - $0.00 = $2,555.00,
    //       which exceeds $1,500.00, so line 19 =                $1,500.00
    //
    //   Form 8880: line 2 = W-2 box 12 code D                    $2,000.00
    //       (code DD's $9,800.00 is employer health coverage and is NOT a
    //       deferral); line 6 = min($2,000.00, the $2,000.00 cap); line 7 =
    //       $2,000.00; line 8 = $39,000.00, which is over $25,500.00 and not
    //       over $39,500.00, so line 9 = 10%; line 10 =            $200.00
    //   Form 8880's Credit Limit Worksheet: $2,555.00 - $1,500.00 =
    //       $1,055.00, which exceeds $200.00, so line 12 =         $200.00
    //
    //   Schedule 3 line 8 = $1,500.00 + $200.00 -> 1040 line 20  $1,700.00
    //   1040 line 21 = line 19 ($0.00) + line 20                 $1,700.00
    //   1040 line 22 = $2,555.00 - $1,700.00                       $855.00
    //   1040 line 24 (line 22 + Schedule 2 Part II $0.00)          $855.00
    //   1040 line 29 (refundable)                                $1,000.00
    //   1040 line 32/33 (no withholding on this W-2)             $1,000.00
    //   1040 line 34 = $1,000.00 - $855.00                         $145.00
    //
    // The last figure is the point of the whole phase for this persona: the
    // return goes from owing to being owed.
    scheduleThreeCredits: {
        theStudentWithAFourOhOneKayGetsBothCreditsThroughScheduleThree: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFiveInputs)
            assert(outcome.kind === 'ok', ['expected the student return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            /** @type {(rule: string) => bigint} */
            const cents = rule => lineRuled(outcome.lines)(rule).value
            assertEq(cents('1040 line 1a'), 3900000n, '$39,000.00 of wages')
            assertEq(cents('1040 line 11'), 3900000n, 'AGI — no Schedule 1 adjustments')
            assertEq(cents('1040 line 15'), 2325000n, '$39,000.00 - $15,750.00 = $23,250.00')
            assertEq(cents('1040 line 18'), 255500n, '$2,555.00 — the Tax Table band midpoint, dollar-rounded')
            assertEq(cents('1040 line 20'), 170000n, '$1,700.00 — Schedule 3 Part I total')
            assertEq(cents('1040 line 21'), 170000n, 'line 19 ($0.00) + line 20')
            assertEq(cents('1040 line 22'), 85500n, '$2,555.00 - $1,700.00 = $855.00')
            assertEq(cents('1040 line 29'), 100000n, '$1,000.00 refundable — never through Schedule 3')
            assertEq(cents('1040 line 31'), 0n, 'Schedule 3 Part II is untouched by this phase')
            assertEq(cents('1040 line 34'), 14500n, '$145.00 overpaid — this return was owing before Phase 25')
            assertEq(cents('1040 line 37'), 0n, 'and nothing is owed')
        },
        // **The two halves land on DIFFERENT 1040 lines, and neither is the
        // other.** A wiring that sent the whole Form 8863 credit through
        // Schedule 3, or the whole of it to line 29, would still produce a
        // plausible-looking return; this is the leaf that says which is
        // which.
        theRefundableAndNonrefundableHalvesLandOnTwoDifferentLines: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFiveInputs)
            assert(outcome.kind === 'ok', ['expected the student return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            const line20 = lineRuled(outcome.lines)('1040 line 20')
            const line29 = lineRuled(outcome.lines)('1040 line 29')
            assertEq(line29.value, 100000n, '40% of $2,500.00 is refundable')
            // Line 20 is the NONrefundable $1,500.00 plus the saver's
            // $200.00 — so it is neither $2,500.00 (the whole education
            // credit) nor $2,700.00 (the whole of both forms).
            assertEq(line20.value, 170000n)
            assert(
                line20.value !== 250000n && line20.value !== 270000n,
                ['the refundable half must not reach the nonrefundable line', line20.value],
            )
            // …and the two together are the whole of both forms, so nothing
            // was dropped on the way.
            assertEq(line20.value + line29.value, 270000n, '$1,700.00 + $1,000.00 = $2,700.00')
        },
        // The saver's credit reads exactly code D and NOT code DD, end to
        // end. The fixture's W-2 carries $9,800.00 of code DD beside
        // $2,000.00 of code D; a read that took "any box 12 entry" would
        // give 10% of the $2,000 cap either way, so this leaf pins the
        // figure that DISTINGUISHES them — Form 8880 line 2 itself, off the
        // schedule's own result.
        onlyTheDeferralCodesReachFormEightyEightyLineTwo: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFiveInputs)
            assert(outcome.kind === 'ok', ['expected the student return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            // An independent `scheduleThree(...)` call over the SAME inputs
            // must reach the identical figures — the cross-check idiom this
            // file already uses for `form8812` and `scheduleD`.
            const crossCheck = scheduleThree(taxParams2025)({
                profile: storedProfile(phaseTwentyFiveProfile),
                status: 'single',
                agiCents: 3900000n,
                line18Cents: 255500n,
                w2Forms: [phaseTwentyFiveW2],
                creditForms: [phaseTwentyFiveCredits],
                tuitionForms: [phaseTwentyFiveOneZeroNineEightT],
                aStored1099RProvesADistribution: false,
            })
            assert(crossCheck.kind === 'ok', ['expected the cross-check to compute', crossCheck])
            if (crossCheck.kind !== 'ok') {
                throw ['expected ok', crossCheck]
            }
            assertEq(
                crossCheck.form8880.columns[0]?.line2,
                200000n,
                '$2,000.00 of code D — never the $11,800.00 that including code DD would give',
            )
            assertEq(crossCheck.line4.value, 20000n, '10% of $2,000.00 = $200.00')
            assertEq(
                crossCheck.line8.value,
                lineRuled(outcome.lines)('1040 line 20').value,
                'the independent call must reach the SAME 1040 line 20',
            )
        },
        // **§26's ordering, end to end, in money.** Schedule 3's credits are
        // subtracted from the tax BEFORE the child tax credit sees it, and
        // the difference is large and visible on three separate 1040 lines.
        //
        // Hand-derived, continuing from the arithmetic above and adding one
        // qualifying child aged 10:
        //
        //   Schedule 8812 line 5 = 1 x $2,200.00                 $2,200.00
        //   line 9 = $200,000.00, so line 11 = $0.00 and
        //       line 12 =                                        $2,200.00
        //   Credit Limit Worksheet A: line 1 = 1040 line 18       $2,555.00
        //       line 2 = Schedule 3 lines 3 + 4                   $1,700.00
        //       line 3 =                                            $855.00
        //   line 14 = min($2,200.00, $855.00) -> 1040 line 19       $855.00
        //   line 16a = $2,200.00 - $855.00                        $1,345.00
        //   line 16b = 1 x $1,700.00                              $1,700.00
        //   line 17 = min($1,345.00, $1,700.00)                   $1,345.00
        //   line 19 = $39,000.00 - $2,500.00                     $36,500.00
        //   line 20 = 15% of line 19                              $5,475.00
        //   line 27 = min($1,345.00, $5,475.00) -> 1040 line 28   $1,345.00
        //
        //   1040 line 21 = $855.00 + $1,700.00                    $2,555.00
        //   1040 line 22 = $2,555.00 - $2,555.00                      $0.00
        //   1040 line 32 = $1,345.00 + $1,000.00                  $2,345.00
        //   1040 line 34 =                                        $2,345.00
        //
        // **What ordering costs and what it does not.** The child tax credit
        // drops from $2,200.00 to $855.00 because the education and saver's
        // credits took the tax first — and $1,345.00 of it reappears on line
        // 28 as the ADDITIONAL child tax credit, refunded. Ordering moves
        // money between two 1040 lines; it does not destroy it. A wiring
        // that passed `0n` for Credit Limit Worksheet A's line 2 would give
        // line 19 = $2,200.00, line 28 = $0.00 and line 34 = $1,000.00 — a
        // return $1,345.00 worse for the taxpayer, computed confidently.
        scheduleThreeCreditsAreOrderedBeforeTheChildTaxCredit: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFiveWithDependentInputs)
            assert(outcome.kind === 'ok', ['expected the return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            /** @type {(rule: string) => bigint} */
            const cents = rule => lineRuled(outcome.lines)(rule).value
            assertEq(cents('1040 line 18'), 255500n, 'the same $2,555.00 of tax')
            assertEq(cents('1040 line 20'), 170000n, 'Schedule 3 takes $1,700.00 of it first')
            assertEq(cents('1040 line 19'), 85500n, '$855.00 of child tax credit is what is left')
            assert(
                cents('1040 line 19') !== 220000n,
                ['the child tax credit must NOT be the full $2,200.00', cents('1040 line 19')],
            )
            assertEq(cents('1040 line 21'), 255500n, '$855.00 + $1,700.00 exactly consumes the tax')
            assertEq(cents('1040 line 22'), 0n)
            assertEq(cents('1040 line 28'), 134500n, '$1,345.00 reappears as the ADDITIONAL child tax credit')
            assertEq(cents('1040 line 29'), 100000n, 'and the refundable education half is untouched')
            assertEq(cents('1040 line 34'), 234500n, '$2,345.00 refunded')
        },
        // **Criterion 4, stated as a leaf.** A return claiming no credits
        // computes exactly what it computed before this phase: the same
        // fixture with the two credit documents removed and the three kinds
        // undeclared has $0.00 on lines 20, 29 and 31, and its line 22 is
        // the whole $2,555.00 of tax.
        theSameReturnWithoutTheCreditDocumentsIsUnchanged: () => {
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile({
                    ...phaseTwentyFiveProfile,
                    declaredKinds: ['wages'],
                }))([phaseTwentyFiveW2])([])([])([])([])([])([])([])([]),
            })
            assert(outcome.kind === 'ok', ['expected the control return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            /** @type {(rule: string) => bigint} */
            const cents = rule => lineRuled(outcome.lines)(rule).value
            assertEq(cents('1040 line 18'), 255500n, 'the same $2,555.00 of tax')
            assertEq(cents('1040 line 20'), 0n)
            assertEq(cents('1040 line 29'), 0n)
            assertEq(cents('1040 line 31'), 0n)
            assertEq(cents('1040 line 22'), 255500n, 'the whole tax, with nothing credited against it')
            assertEq(cents('1040 line 37'), 255500n, 'and the whole of it owed')
        },
    },
    scheduleOneAdjustments: {
        theNonProfitEmployeeReturnDeductsAllThreeAdjustmentsThroughLineTen: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFourInputs)
            assert(outcome.kind === 'ok', ['expected the non-profit employee return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            // Hand-computed from the printed forms, independently of the code
            // under test:
            //
            //   1040 line 1a/1z = W-2 box 1                       $52,000.00
            //   1040 line 9  (total income)                       $52,000.00
            //   Sch 1 line 11 = min($300.00, §62's $300.00 cap)       $300.00
            //   Sch 1 line 13 = Form 8889: line 3 $4,300.00, line 9
            //       $500.00 (W-2 box 12 code W), line 12 $3,800.00,
            //       line 2 $2,000.00, line 13 = min of the two     $2,000.00
            //   Sch 1 line 21 = worksheet: line 1 min($1,842.63,
            //       $2,500.00) = $1,842.63; line 2 $52,000.00; line 3
            //       $300.00 + $2,000.00 = $2,300.00; line 4 $49,700.00;
            //       line 5 $85,000.00; line 4 is NOT more than line 5, so
            //       line 8 is $0.00 and line 9 is                  $1,842.63
            //   Sch 1 line 26 -> 1040 line 10                      $4,142.63
            //   1040 line 11a/11b (AGI) = $52,000.00 - $4,142.63  $47,857.37
            //   1040 line 12e = single standard deduction          $15,750.00
            //   1040 line 15 = $47,857.37 - $15,750.00            $32,107.37
            assertEq(lineRuled(outcome.lines)('1040 line 1a').value, 5200000n, '$52,000.00 of wages')
            assertEq(lineRuled(outcome.lines)('1040 line 9').value, 5200000n, '$52,000.00 total income')
            assertEq(lineRuled(outcome.lines)('1040 line 10').value, 414263n,
                '$300.00 + $2,000.00 + $1,842.63 = $4,142.63')
            assertEq(lineRuled(outcome.lines)('1040 line 11a').value, 4785737n, '$47,857.37 AGI')
            assertEq(lineRuled(outcome.lines)('1040 line 11b').value, 4785737n, 'restated on page 2')
            assertEq(lineRuled(outcome.lines)('1040 line 12e').value, 1575000n, '$15,750.00')
            assertEq(lineRuled(outcome.lines)('1040 line 15').value, 3210737n, '$32,107.37 taxable income')
            assert(
                lineRuled(outcome.lines)('1040 line 10').value > 0n,
                ['line 10 must be a REAL figure, not the hard zero this phase replaced',
                    lineRuled(outcome.lines)('1040 line 10').value],
            )
        },
        // The DIFFERENTIAL, and the strongest single statement in this group:
        // the identical return with no adjustment documents at all must have
        // a taxable income exactly $4,142.63 HIGHER. That is the overstatement
        // this phase removes, priced.
        //
        // Deliberately a difference rather than two absolute figures: it does
        // not depend on the Tax Table, the standard deduction, or anything
        // else that could move for an unrelated reason, so it can only fail
        // if the adjustments stop flowing through to taxable income.
        theSameReturnWithoutTheDocumentsIsExactlyThatMuchMoreTaxable: () => {
            const withAdjustments = form1040Report(taxParams2025)(phaseTwentyFourInputs)
            const without = form1040Report(taxParams2025)({
                ...phaseTwentyFourInputs,
                adjustmentForms: [],
                studentLoanInterestForms: [],
                w2s: [w2Document('sha256-p24-w2')('52000.00')],
            })
            assert(withAdjustments.kind === 'ok', ['expected ok', withAdjustments])
            assert(without.kind === 'ok', ['expected ok', without])
            if (withAdjustments.kind !== 'ok' || without.kind !== 'ok') {
                throw ['expected two computed returns', withAdjustments, without]
            }
            const taxableWith = lineRuled(withAdjustments.lines)('1040 line 15').value
            const taxableWithout = lineRuled(without.lines)('1040 line 15').value
            assertEq(taxableWithout - taxableWith, 414263n,
                'the adjustments must reduce taxable income by exactly Schedule 1 line 26')
            assertEq(lineRuled(without.lines)('1040 line 10').value, 0n,
                'and the same return with no adjustment documents is still a legitimate zero')
        },
        // PROV-02, end to end: 1040 line 10 must cite the documents the
        // adjustments actually came from, by the CAS hash a reader can look
        // up — not merely carry a number.
        lineTenCitesEveryDocumentTheAdjustmentsCameFrom: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFourInputs)
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            const sources = lineRuled(outcome.lines)('1040 line 10').sources
            const hashes = sources.map(source => source.documentHash)
            assert(hashes.includes('sha256-p24-adjustments'),
                ['line 10 must cite the adjustments document', sources])
            assert(hashes.includes('sha256-p24-1098e'),
                ['line 10 must cite the 1098-E', sources])
            assert(hashes.includes('sha256-p24-w2'),
                ['line 10 must cite the W-2 whose box 12 code W reduced the HSA limit', sources])
            const boxPaths = sources.map(source => source.boxPath)
            assert(boxPaths.includes('box1StudentLoanInterestReceived'),
                ['line 10 must cite the 1098-E BOX, not merely the document', boxPaths])
            assert(boxPaths.includes('box12[code=W]'),
                ['line 10 must cite the W-2 box that reduced the deduction', boxPaths])
        },
        // The three kinds are MODELED as of this phase, so declaring them is
        // IN SCOPE — the reclassification, exercised through the entry point
        // rather than only against `classifyScope`. Before this phase the
        // identical declaration refused the whole return.
        decliningToDeclareIsNotRequiredAndDeclaringIsInScope: () => {
            const outcome = form1040Report(taxParams2025)(phaseTwentyFourInputs)
            assertEq(outcome.kind, 'ok', 'the three reclassified kinds must not refuse')
            assertEq(
                JSON.stringify(phaseTwentyFourProfile.declaredKinds),
                JSON.stringify([
                    'wages', 'educatorExpenses', 'healthSavingsAccountDeduction',
                    'studentLoanInterestDeduction', 'federalTaxWithheldOnW2',
                ]),
                'the fixture really does declare all three, or the leaf above proves nothing',
            )
        },
        // **THE SOCIAL SECURITY INTERACTION — added after a mutation.**
        //
        // `fjs/tax/ssb`'s line 6 subtracts Schedule 1 "lines 11 through 20,
        // and 23 and 25", and this phase made that a REAL figure where it was
        // a hardcoded `0n`. Verification neutralized the wiring
        // (`socialSecurityWorksheetAdjustmentsTotal(...) * 0n`) and the whole
        // suite stayed green: not one fixture anywhere carried BOTH Social
        // Security benefits and a Schedule 1 adjustment, so the newly-real
        // read was observed by nothing. This leaf is that fixture.
        //
        // Single filer, $30,000.00 of SSA-1099 box 5, a $30,000.00 taxable
        // pension, and a $2,000.00 HSA contribution. Hand-computed from the
        // printed worksheet:
        //
        //   line 1  $30,000.00   line 2  $15,000.00 (half)
        //   line 3  $30,000.00 (the pension, 1040 line 5b)
        //   line 4  $0.00        line 5  $45,000.00
        //   line 6  $2,000.00 <- Schedule 1 line 13, the figure at issue
        //   line 7  $43,000.00   line 8  $25,000.00 (single base)
        //   line 9  $18,000.00   line 10 $9,000.00 (single second threshold)
        //   line 11 $9,000.00    line 12 $9,000.00 (smaller of 9 and 10)
        //   line 13 $4,500.00    line 14 $4,500.00 (smaller of 2 and 13)
        //   line 15 $7,650.00 (85% of line 11)
        //   line 16 $12,150.00   line 17 $25,500.00 (85% of line 1)
        //   line 18 $12,150.00 -> 1040 line 6b
        //
        // The differential is the sharp half: with line 6 at $0.00 the same
        // worksheet gives line 9 $20,000.00, line 11 $11,000.00, line 15
        // $9,350.00 and line 18 $13,850.00 — exactly $1,700.00 more, which is
        // 85% of the $2,000.00 adjustment. That 85% relationship can only
        // hold if line 6 is genuinely read.
        aScheduleOneAdjustmentReducesTaxableSocialSecurityThroughWorksheetLineSix: () => {
            const withAdjustment = form1040Report(taxParams2025)(socialSecurityWithHsaInputs)
            const without = form1040Report(taxParams2025)({
                ...socialSecurityWithHsaInputs,
                adjustmentForms: [],
            })
            assert(withAdjustment.kind === 'ok', ['expected ok', withAdjustment])
            assert(without.kind === 'ok', ['expected ok', without])
            if (withAdjustment.kind !== 'ok' || without.kind !== 'ok') {
                throw ['expected two computed returns', withAdjustment, without]
            }
            const sixBWith = lineRuled(withAdjustment.lines)('1040 line 6b').value
            const sixBWithout = lineRuled(without.lines)('1040 line 6b').value
            assertEq(sixBWith, 1215000n, '$12,150.00, hand-computed from the worksheet with line 6 = $2,000.00')
            assertEq(sixBWithout, 1385000n, '$13,850.00, the SAME worksheet with line 6 = $0.00')
            assertEq(sixBWithout - sixBWith, 170000n,
                '$1,700.00 — exactly 85% of the $2,000.00 adjustment, the 85% tier this return sits in')
            // …and the adjustment ALSO reduces AGI directly through line 10,
            // so the total effect is larger than either half alone: taxable
            // Social Security falls $1,700.00 AND line 10 removes $2,000.00.
            assertEq(lineRuled(withAdjustment.lines)('1040 line 10').value, 200000n)
            assertEq(
                lineRuled(without.lines)('1040 line 11a').value
                    - lineRuled(withAdjustment.lines)('1040 line 11a').value,
                370000n,
                '$1,700.00 of taxable benefits plus the $2,000.00 adjustment itself',
            )
        },
        // **THE PHASE-OUT, END TO END — also added after a mutation.**
        //
        // Verification replaced the `totalIncomeLine` passed into Part II
        // stage 2 with a zero-valued line, and the suite stayed green: the
        // persona fixture above sits at $52,000.00, far below the $85,000.00
        // threshold, so a zero income and a $52,000.00 income both produce
        // the full deduction. Nothing end to end observed 1040 line 9
        // reaching the worksheet at all.
        //
        // Single filer, $95,000.00 of wages, $2,000.00 of student loan
        // interest, no other adjustments. Hand-computed from the printed
        // worksheet: line 1 min($2,000.00, $2,500.00) = $2,000.00; line 2
        // $95,000.00; line 3 $0.00; line 4 $95,000.00; line 5 $85,000.00;
        // line 6 $10,000.00; line 7 = 10,000 / 15,000 = 0.6666…, rounded to
        // three places = 0.667; line 8 $2,000.00 x 0.667 = $1,334.00; line 9
        // $2,000.00 - $1,334.00 = $666.00.
        thePhaseOutBitesThroughTheFullEntryPoint: () => {
            const outcome = form1040Report(taxParams2025)(phaseOutInputs)
            assert(outcome.kind === 'ok', ['expected the phased-out return to compute', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
            assertEq(lineRuled(outcome.lines)('1040 line 9').value, 9500000n, '$95,000.00 total income')
            assertEq(lineRuled(outcome.lines)('1040 line 10').value, 66600n,
                '$666.00 — the phased-out remainder of a $2,000.00 deduction')
            assertEq(lineRuled(outcome.lines)('1040 line 11a').value, 9433400n, '$94,334.00 AGI')
            // The two figures a wrong wiring would produce instead, named so
            // the leaf says what it refuses: $2,000.00 is the whole,
            // un-phased-out deduction (a worksheet fed no income at all), and
            // $0.00 is line 21 never reaching line 26.
            assert(
                lineRuled(outcome.lines)('1040 line 10').value !== 200000n,
                'a worksheet fed a zero total income would deduct the whole $2,000.00',
            )
            assert(
                lineRuled(outcome.lines)('1040 line 10').value !== 0n,
                'and a line 21 that never reached line 26 would deduct nothing',
            )
        },
        // A Part II refusal must stop the WHOLE return, threaded through the
        // same error arm the Schedule A and Schedule D guards use — never a
        // partial 1040 with a quietly dropped adjustment.
        aPartTwoRefusalStopsTheWholeReturn: () => {
            const outcome = form1040Report(taxParams2025)({
                ...phaseTwentyFourInputs,
                adjustmentForms: [{
                    documentHash: 'sha256-p24-adjustments',
                    value: {
                        ...phaseTwentyFourAdjustments.value,
                        entries: [{
                            lineTag: 'alimonyPaid',
                            datePaid: '2025-04-01',
                            description: 'court-ordered alimony',
                            amount: '9000.00',
                            individual: 'taxpayer',
                        }],
                    },
                }],
            })
            assertEq(outcome.kind, 'error')
            if (outcome.kind !== 'error') {
                throw ['expected a refusal', outcome]
            }
            assert(outcome.message.includes('alimonyPaid'),
                ['the refusal must name the tag it could not compute', outcome.message])
            // A document-data-sufficiency refusal, never a scope one: it
            // names no `fjs/return/scope` kind.
            assertEq(outcome.unmodeled.length, 0)
        },
    },
    // ── Phase 26 (TAX-28/TAX-29): the QCD and Form 8606 through the FULL
    //    report, and the second-order effects nothing else would have seen ───
    //
    // `fjs/form8606` proves its own arithmetic against facts. What only THIS
    // file can prove is that the figure reaches the return through the
    // ordinary path — line 4b, and thence line 9, AGI, and everything AGI
    // drives.
    retireeCompletion: {
        // **Criterion 1.** The printed instruction, verbatim: *"enter the
        // total distribution on line 4a. … If only part of the distribution
        // is a QCD, enter the part that is not a QCD on line 4b."* So line 4a
        // stays GROSS while line 4b falls. A design that netted the gift off
        // the gross would be invisible on line 4b alone.
        lineFourAStaysGrossWhileFourBFalls: () => {
            const iraDistribution = retirementDocument('sha256-26-r')({
                box1GrossDistribution: '50000.00',
                box2aTaxableAmount: '50000.00',
                box2bTaxableAmountNotDetermined: true,
                box7bIraSepSimple: true,
            })
            /** @type {Stored<Ira>} */
            const record = {
                documentHash: 'sha256-26-ira',
                value: {
                    dialect: 'vnd.fjs.ira',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '66-6666666',
                        accountNumber: 'ACC-R',
                        charity: 'Riverside Food Bank',
                        amount: '20000.00',
                    }],
                },
            }
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['iraDistributions'],
            }
            const withGift = expectIncomeOk(form1040IncomeLines(taxParams2025)({
                ...inputsOf(storedProfile(profile))([])([])([])([])(
                    [iraDistribution])([])([])([])([]),
                iraForms: [record],
            }))
            assertEq(withGift.line4a.value, 5000000n, '$50,000.00 — line 4a is UNTOUCHED')
            assertEq(withGift.line4b.value, 3000000n, '$50,000.00 - $20,000.00')
            // The same return with no `vnd.fjs.ira` document at all: BOTH
            // lines are the gross figure, which is what this engine did
            // before Phase 26 and is the overstatement TAX-28 closes.
            const withoutGift = expectIncomeOk(form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(profile))([])([])([])([])(
                    [iraDistribution])([])([])([])([])))
            assertEq(withoutGift.line4a.value, 5000000n)
            assertEq(withoutGift.line4b.value, 5000000n, 'taxed in full, silently, before this phase')
            // Line 4a is not merely equal across the two — it is the SAME
            // figure the gross box reports, cited to that box.
            assert(
                withGift.line4a.sources.some(source =>
                    source.boxPath === 'box1GrossDistribution' && source.value === '50000.00'),
                ['line 4a must still cite the gross box', withGift.line4a.sources])
        },
        // **The deliberate regression hunt.** AGENTS.md and this phase's own
        // brief both record that Phase 24 shipped a newly-real read in the
        // Social Security Benefits Worksheet that no fixture exercised. Line
        // 4b is worksheet line 3's own summand, so a QCD moves TAXABLE SOCIAL
        // SECURITY as well as the distribution itself — and that second-order
        // effect is larger than a reader would guess.
        //
        // $30,000 of Social Security, a $40,000 IRA distribution, $20,000 of
        // it given to charity. Both worksheets hand-derived:
        //
        //   WITHOUT the gift            WITH the gift
        //   1  30,000                   1  30,000
        //   2  15,000  (50%)            2  15,000
        //   3  40,000  (line 4b)        3  20,000  (line 4b)
        //   4       0                   4       0
        //   5  55,000  (2+3+4)          5  35,000
        //   7  55,000                   7  35,000
        //   8  25,000  (single base)    8  25,000
        //   9  30,000                   9  10,000
        //   10  9,000                   10  9,000
        //   11 21,000                   11  1,000
        //   12  9,000  (min of 9,10)    12  9,000
        //   13  4,500  (50% of 12)      13  4,500
        //   14  4,500  (min of 2,13)    14  4,500
        //   15 17,850  (85% of 11)      15    850  (85% of 1,000)
        //   16 22,350                   16  5,350
        //   17 25,500  (85% of 1)       17 25,500
        //   18 22,350  -> line 6b       18  5,350  -> line 6b
        //
        // So a $20,000 gift takes $17,000 off taxable Social Security ON TOP
        // of the $20,000 it takes off the distribution. Taxable income falls
        // from $38,600.00 to $1,600.00 and the tax from $4,397.00 to $161.00
        // — $4,236.00 on a $20,000 gift, where the distribution alone would
        // have accounted for about $2,400.
        //
        // `[MOVED FIGURE, and the reason it moved]` This comment first said
        // $163.00, from a hand derivation that assumed the Tax Table's rows
        // are $50 wide everywhere. **They are not**: `fjs/tax/table`'s own
        // verified five-region band structure puts $25 rows between $25.00
        // and $3,000.00, and $50 rows only above that. So the $1,600.00 row
        // is "$1,600.00 but less than $1,625.00", its midpoint is $1,612.50
        // rather than $1,625.00, and 10% of it is $161.25, which rounds to
        // $161.00. The $38,600.00 row is above $3,000.00 and IS $50 wide, so
        // that half of the derivation was right — which is exactly why the
        // error survived being written down. Corrected by re-deriving off the
        // printed band structure, not by copying the engine's answer.
        theQcdReachesTheSocialSecurityWorksheetThroughLineFourB: () => {
            const iraDistribution = retirementDocument('sha256-26-ssb-r')({
                box1GrossDistribution: '40000.00',
                box2aTaxableAmount: '40000.00',
                box2bTaxableAmountNotDetermined: true,
                box7bIraSepSimple: true,
            })
            const ssaForm = socialSecurityDocument('sha256-26-ssb-ssa')('30000.00')
            /** @type {Stored<Ira>} */
            const record = {
                documentHash: 'sha256-26-ssb-ira',
                value: {
                    dialect: 'vnd.fjs.ira',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '66-6666666',
                        accountNumber: 'ACC-R',
                        charity: 'Riverside Food Bank',
                        amount: '20000.00',
                    }],
                },
            }
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: [
                    'iraDistributions', 'socialSecurityBenefits',
                    'seniorAndOtherScheduleOneADeductions',
                ],
            }
            const base = inputsOf(storedProfile(profile))([])([])([])([])(
                [iraDistribution])([ssaForm])([])([])([])
            const without = form1040Report(taxParams2025)(base)
            const with_ = form1040Report(taxParams2025)({ ...base, iraForms: [record] })
            assert(without.kind === 'ok' && with_.kind === 'ok', ['expected both to compute'])
            if (without.kind !== 'ok' || with_.kind !== 'ok') {
                return
            }
            assertEq(lineRuled(without.lines)('1040 line 4b').value, 4000000n, '$40,000.00')
            assertEq(lineRuled(without.lines)('1040 line 6b').value, 2235000n, '$22,350.00')
            assertEq(lineRuled(with_.lines)('1040 line 4b').value, 2000000n, '$20,000.00')
            assertEq(lineRuled(with_.lines)('1040 line 6b').value, 535000n, '$5,350.00')
            // The claim this leaf exists for, as an inequality rather than as
            // prose: line 6b MOVED, and by more than nothing.
            assert(
                lineRuled(with_.lines)('1040 line 6b').value
                    < lineRuled(without.lines)('1040 line 6b').value,
                ['a QCD must reduce taxable Social Security too, through line 4b'],
            )
            // Independent cross-check: an isolated call to the worksheet with
            // the reduced line 3 must reach the same figure, so the wiring is
            // proven to feed the SAME facts rather than merely to produce a
            // number that happens to be smaller.
            assertEq(
                socialSecurityBenefitsWorksheet(taxParams2025)({
                    status: 'single',
                    mfsLivedWithSpouseAtAnyTimeInYear: false,
                    totalSsaAndRrbBox5Cents: 3000000n,
                    otherIncomeLine3Cents: 2000000n,
                    taxExemptInterestCents: 0n,
                    scheduleOneAdjustmentsTotalCents: 0n,
                }).line18,
                535000n,
                'an independent worksheet call over the REDUCED line 3 reaches the same $5,350.00')
            // …and all the way through to the tax. AGI without =
            // $40,000.00 + $22,350.00 = $62,350.00; with = $20,000.00 +
            // $5,350.00 = $25,350.00. Both are under the $75,000.00 senior
            // phase-out threshold, so line 13b is the full $6,000.00 in each
            // and the deduction is $15,750.00 + $2,000.00 + $6,000.00 =
            // $23,750.00. Taxable income $38,600.00 and $1,600.00; Tax Table
            // midpoints $38,625.00 and $1,625.00 give
            // 11,925 x 10% + 26,700 x 12% = $4,396.50 -> $4,397.00, and
            // 1,625 x 10% = $162.50 -> $163.00.
            assertEq(lineRuled(without.lines)('1040 line 11b').value, 6235000n, '$62,350.00 AGI')
            assertEq(lineRuled(with_.lines)('1040 line 11b').value, 2535000n, '$25,350.00 AGI')
            assertEq(lineRuled(without.lines)('1040 line 13b').value, 600000n, 'full senior deduction')
            assertEq(lineRuled(with_.lines)('1040 line 13b').value, 600000n, 'full senior deduction')
            assertEq(lineRuled(without.lines)('1040 line 15').value, 3860000n, '$38,600.00')
            assertEq(lineRuled(with_.lines)('1040 line 15').value, 160000n, '$1,600.00')
            assertEq(lineRuled(without.lines)('1040 line 16').value, 439700n, '$4,397.00')
            assertEq(lineRuled(with_.lines)('1040 line 16').value, 16100n, '$161.00 — a $25-wide Tax Table row, midpoint $1,612.50')
        },
        // Form 8606's line 15c reaches line 4b through the same path, and it
        // REPLACES the box-2a reading rather than adjusting it — which is the
        // printed instruction ("see Form 8606 and its instructions to figure
        // the amount to enter on line 4b").
        //
        // $50,000 distributed, $20,000 of prior-year basis, $150,000 of
        // aggregated IRAs left at 31 December: line 9 = 200,000, line 10 =
        // 0.100, line 12 = $5,000.00, line 15c = $45,000.00.
        formEightSixZeroSixsLineFifteenCReachesLineFourB: () => {
            const iraDistribution = retirementDocument('sha256-26-8606-r')({
                box1GrossDistribution: '50000.00',
                box2aTaxableAmount: '50000.00',
                box2bTaxableAmountNotDetermined: true,
                box7bIraSepSimple: true,
            })
            /** @type {Stored<Ira>} */
            const record = {
                documentHash: 'sha256-26-8606-ira',
                value: {
                    dialect: 'vnd.fjs.ira',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    yearEndValueOfAllTraditionalSepSimpleIras: '150000.00',
                },
            }
            /** @type {Stored<PriorYearIraBasis>} */
            const basis = {
                documentHash: 'sha256-26-8606-basis',
                value: {
                    dialect: 'vnd.fjs.prior_year_ira_basis',
                    recipientTin: '222-22-2222',
                    taxYear: 2024,
                    priorYearForm8606Line14: '20000.00',
                },
            }
            /** @type {ReturnProfile} */
            const profile = { ...singleProfile, declaredKinds: ['iraDistributions'] }
            const lines = expectIncomeOk(form1040IncomeLines(taxParams2025)({
                ...inputsOf(storedProfile(profile))([])([])([])([])(
                    [iraDistribution])([])([])([])([]),
                iraForms: [record],
                priorYearIraBasisForms: [basis],
            }))
            assertEq(lines.line4a.value, 5000000n, 'still gross')
            assertEq(lines.line4b.value, 4500000n, '$45,000.00, not the $50,000.00 box 2a reports')
            assertEq(lines.line9.value, 4500000n, 'and it is line 9 that the reduction reaches')
        },
        // A `fjs/form8606` refusal stops the WHOLE return, threaded like every
        // other document-data-sufficiency refusal in this file: `unmodeled` is
        // empty, and no partial line list can be constructed.
        aFormEightSixZeroSixRefusalStopsTheWholeReturn: () => {
            const iraDistribution = retirementDocument('sha256-26-refuse-r')({
                box1GrossDistribution: '50000.00',
                box2aTaxableAmount: '50000.00',
                box7bIraSepSimple: true,
            })
            /** @type {Stored<Ira>} */
            const record = {
                documentHash: 'sha256-26-refuse-ira',
                value: {
                    dialect: 'vnd.fjs.ira',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    attainedAgeSeventyAndAHalfAtEveryDistributionBelow: true,
                    qualifiedCharitableDistributions: [{
                        payerTin: '66-6666666',
                        accountNumber: 'ACC-R',
                        charity: 'Riverside Food Bank',
                        amount: '20000.00',
                    }],
                },
            }
            /** @type {ReturnProfile} */
            const profile = { ...singleProfile, declaredKinds: ['iraDistributions'] }
            // The profile checks NO line-12d age box, so the 70½ assertion is
            // contradicted by the return's own declaration.
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([])([])([])([])(
                    [iraDistribution])([])([])([])([]),
                iraForms: [record],
            })
            assertEq(outcome.kind, 'error')
            if (outcome.kind !== 'error') {
                throw ['expected a refusal', outcome]
            }
            assert(outcome.message.includes('line-12d'), ['name the contradiction', outcome.message])
            assertEq(outcome.unmodeled.length, 0, 'a data-sufficiency refusal names no scope kind')
            assertEq(Object.hasOwn(outcome, 'lines'), false, 'no partial return is constructible')
            // The CONTROL: the identical return with the age box checked
            // computes, so the gate is a gate rather than a wall.
            const control = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile({ ...profile, taxpayerBornBeforeJan2_1961: true }))(
                    [])([])([])([])([iraDistribution])([])([])([])([]),
                iraForms: [record],
            })
            assertEq(control.kind, 'ok')
        },
        // **Criterion 4, at the whole-report level.** The Phase 21 fixture
        // has no Form 1099-R at all, so this phase must be invisible to it —
        // and the two figures its own module pins (line 1a $45,505.00, line
        // 34 $5,535.00) are restated HERE, hand-typed a second time, so that
        // a change to this file which moved them would fail in this file too
        // rather than only one module over.
        thePhaseTwentyOneFixtureIsUntouchedByThisPhase: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: [
                    'wages', 'unemploymentCompensation',
                    'federalTaxWithheldOnW2', 'federalTaxWithheldOnOther1099',
                ],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-26-p21-a')('35937.00'),
                    w2Document('sha256-26-p21-b')('9568.00'),
                ])([])([])([])([])([])([])([])([]),
                w2s: [
                    {
                        documentHash: 'sha256-26-p21-a',
                        value: {
                            dialect: w2Dialect,
                            payerTin: '11-1111111',
                            recipientTin: '222-22-2222',
                            accountNumber: 'ACC-W2-A',
                            taxYear: 2025,
                            formRevision: '2025',
                            box1WagesTipsOtherCompensation: '35937.00',
                            box2FederalIncomeTaxWithheld: '6384.00',
                        },
                    },
                    {
                        documentHash: 'sha256-26-p21-b',
                        value: {
                            dialect: w2Dialect,
                            payerTin: '44-4444444',
                            recipientTin: '222-22-2222',
                            accountNumber: 'ACC-W2-B',
                            taxYear: 2025,
                            formRevision: '2025',
                            box1WagesTipsOtherCompensation: '9568.00',
                            box2FederalIncomeTaxWithheld: '2578.00',
                        },
                    },
                ],
                unemploymentForms: [{
                    documentHash: 'sha256-26-p21-g',
                    value: {
                        dialect: 'vnd.fjs.1099g',
                        payerTin: '55-5555555',
                        recipientTin: '222-22-2222',
                        accountNumber: 'ACC-1099G',
                        taxYear: 2025,
                        formRevision: '2025',
                        box1UnemploymentCompensation: '4554.00',
                        box4FederalIncomeTaxWithheld: '454.00',
                    },
                }],
            })
            assert(outcome.kind === 'ok', ['expected the Phase 21 fixture to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            assertEq(lineRuled(outcome.lines)('1040 line 1a').value, 4550500n, '$45,505.00')
            assertEq(lineRuled(outcome.lines)('1040 line 34').value, 553500n, '$5,535.00')
            // …and this phase genuinely did nothing: line 4a and line 4b are
            // the profile-declared zero they always were, citing the
            // declaration rather than any 1099-R.
            const line4b = lineRuled(outcome.lines)('1040 line 4b')
            assertEq(line4b.value, 0n)
            assertEq(line4b.sources.length, 1)
            assertEq(line4b.sources[0]?.boxPath, 'declaredKinds')
        },
    },
    // ── Phase 29 (DOC-22/TAX-33): the alternative minimum tax, end to end ──
    alternativeMinimumTax: {
        // THE WHOLE VERTICAL SLICE, at the entry point: a stored Form 3921
        // reaches Form 6251 line 2i, Schedule 2 line 2 and 1040 line 17, and
        // the tax is the EXCESS over the regular tax.
        //
        // The fixture is chosen so that TWO wirings no other leaf could
        // observe are observable here at once. It is a 65-year-old, so
        // Schedule 1-A line 37 is NON-ZERO and 1040 line 14 therefore differs
        // from line 12e — which is what makes Form 6251 line 2a's "line 12e,
        // not line 14" reading load-bearing. And it exercises an incentive
        // stock option and HOLDS, so the alternative minimum tax is a real
        // six-figure number rather than a zero that would absorb any wiring
        // error. Wages are $130,000.00 rather than $120,000.00 for a third
        // reason: it puts taxable income above $100,000.00, so line 16 comes
        // off the Tax Computation Worksheet exactly rather than off the Tax
        // Table's $50-wide band, and every figure below can be hand-derived.
        //
        // EVERY FIGURE HAND-COMPUTED, in printed order:
        //
        //   1040 line 1a/1z   wages                            $130,000.00
        //   1040 line 11b     AGI (no adjustments)             $130,000.00
        //   1040 line 12e     15,750.00 + 2,000.00 aged         $17,750.00
        //   Sch 1-A line 31   MAGI                             $130,000.00
        //   Sch 1-A line 33   130,000.00 - 75,000.00            $55,000.00
        //   Sch 1-A line 34   6% of 55,000.00                    $3,300.00
        //   Sch 1-A line 35   6,000.00 - 3,300.00                $2,700.00
        //   Sch 1-A line 37   one qualifying taxpayer            $2,700.00
        //   1040 line 13b     = Sch 1-A line 38                  $2,700.00
        //   1040 line 14      17,750.00 + 0 + 2,700.00          $20,450.00
        //   1040 line 15      130,000.00 - 20,450.00           $109,550.00
        //   1040 line 16      10% of 11,925.00                   $1,192.50
        //                   + 12% of 36,550.00                   $4,386.00
        //                   + 22% of 54,875.00                  $12,072.50
        //                   + 24% of  6,200.00                   $1,488.00
        //                                                       $19,139.00
        //
        //   Form 3921         (105.00 - 5.00) x 10,000       $1,000,000.00
        //   6251 line 1a      20,450.00 - 2,700.00              $17,750.00
        //   6251 line 1b      130,000.00 - 17,750.00           $112,250.00
        //   6251 line 2a      1040 line 12e, NOT line 14        $17,750.00
        //   6251 line 2i      the spread                     $1,000,000.00
        //   6251 line 4       112,250 + 17,750 + 1,000,000   $1,130,000.00
        //   6251 line 5       25% of (1,130,000 - 626,350) is 125,912.50,
        //                     which exceeds the 88,100.00 exemption  $0.00
        //   6251 line 6       1,130,000.00 - 0.00            $1,130,000.00
        //   6251 line 7       26% of 239,100.00                 $62,166.00
        //                   + 28% of 890,900.00                $249,452.00
        //                                                      $311,618.00
        //   6251 line 10      1040 line 16                      $19,139.00
        //   6251 line 11      311,618.00 - 19,139.00           $292,479.00
        //
        //   1040 line 17      Schedule 2 line 3                $292,479.00
        //   1040 line 18      19,139.00 + 292,479.00           $311,618.00
        //
        // $292,479.00 of tax on income never received, in a year the filer
        // sold nothing.
        anExerciseAndHoldReachesNineteenFortyLineSeventeen: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions', 'alternativeMinimumTax'],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-amt-w2')('130000.00'),
                ])([])([])([])([])([])([])([])([]),
                isoExerciseForms: [{
                    documentHash: 'sha256-29-amt-3921',
                    value: {
                        dialect: 'vnd.fjs.form3921',
                        payerTin: '11-1111111',
                        recipientTin: '222-22-2222',
                        accountNumber: 'ACC-ISO',
                        taxYear: 2025,
                        formRevision: 'April 2025',
                        sourceArtifactHash:
                            'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                        box1DateOptionGranted: '01/03/2023',
                        box2DateOptionExercised: '03/13/2025',
                        box3ExercisePricePerShare: '5.00',
                        box4FairMarketValuePerShareOnExerciseDate: '105.00',
                        box5NumberOfSharesTransferred: '10000',
                    },
                }],
            })
            assert(outcome.kind === 'ok', ['expected the exercise-and-hold return to compute', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 1a').value, 13000000n, '$130,000.00 of wages')
            assertEq(at('1040 line 12e').value, 1775000n, '$15,750.00 + $2,000.00 aged')
            assertEq(at('1040 line 13b').value, 270000n, 'the phased-out senior deduction, $2,700.00')
            assertEq(at('1040 line 14').value, 2045000n, '$20,450.00 -- and it DIFFERS from line 12e')
            assertEq(at('1040 line 15').value, 10955000n, '$109,550.00 of taxable income')
            assertEq(at('1040 line 16').value, 1913900n, '$19,139.00 of regular tax')
            assertEq(at('1040 line 17').value, 29247900n, '$292,479.00 of alternative minimum tax')
            assertEq(at('1040 line 18').value, 31161800n, '$311,618.00 = $19,139.00 + $292,479.00')
            // Provenance: 1040 line 17 cites the Form 3921 that put the tax
            // there, by hash and by box, so an auditor can see the one
            // document a filer would otherwise never connect to the figure.
            const seventeen = at('1040 line 17')
            const hashes = seventeen.sources.map(source => source.documentHash)
            assert(
                hashes.includes('sha256-29-amt-3921'),
                ['1040 line 17 must cite the Form 3921', hashes])
            const boxes = seventeen.sources.map(source => source.boxPath)
            assert(
                boxes.includes('box4FairMarketValuePerShareOnExerciseDate'),
                ['and the box the spread was computed from', boxes])
        },
        /**
         * ★ **TAX-33's motivating return, end to end** — the ONE combination
         * Phase 29 shipped a refusal for: a large incentive stock option spread
         * **beside qualified dividends**. The AMT's flat 26/28% schedule and
         * §1(h)'s preferential rates both apply, which is what Form 6251 Part
         * III exists to reconcile, and before TAX-33 this return produced no
         * figure at all.
         *
         * A single filer: $250,000.00 of salary, $20,000.00 of qualified
         * dividends, and 10,000 shares exercised at a $5.00 strike against a
         * $105.00 fair market value, held.
         *
         * EVERY FIGURE BELOW IS HAND-DERIVED, with the arithmetic shown. The
         * 2025 single-filer brackets are Rev. Proc. 2024-40 §2.01: 10% to
         * $11,925, 12% to $48,475, 22% to $103,350, 24% to $197,300, 32% to
         * $250,525, 35% to $626,350. Both amounts priced below are ABOVE
         * $100,000, so the Tax Computation Worksheet applies and bracket
         * arithmetic is the right derivation; nothing here is a Tax Table row.
         *
         *   1040 line 1a   salary                             $250,000.00
         *   1040 line 3a   qualified dividends                 $20,000.00
         *   1040 line 3b   ordinary dividends (box 1a)         $20,000.00
         *   1040 line 9    250,000.00 + 20,000.00             $270,000.00
         *   1040 line 11b  no adjustments                     $270,000.00
         *   1040 line 12e  the single standard deduction        $15,750.00
         *   1040 line 15   270,000.00 - 15,750.00             $254,250.00
         *
         *   THE REGULAR TAX, by the QDCGT (1040 line 3a is non-zero):
         *   QDCGT 4        20,000.00 + 0.00                    $20,000.00
         *   QDCGT 5        254,250.00 - 20,000.00             $234,250.00
         *   QDCGT 9        the 0% ceiling 48,350.00 is already buried by
         *                  line 5, so nothing at 0%                  $0.00
         *   QDCGT 17       the whole 20,000.00 at 15%          $20,000.00
         *   QDCGT 18       15% x 20,000.00                      $3,000.00
         *   QDCGT 22       T(234,250.00):
         *                  10% x  11,925.00 =  1,192.50
         *                  12% x  36,550.00 =  4,386.00
         *                  22% x  54,875.00 = 12,072.50
         *                  24% x  93,950.00 = 22,548.00
         *                  32% x  36,950.00 = 11,824.00        $52,023.00
         *   QDCGT 23       3,000.00 + 0.00 + 52,023.00         $55,023.00
         *   QDCGT 24       T(254,250.00) = 40,199.00 (at 197,300.00)
         *                  + 32% x 53,225.00 = 17,032.00
         *                  + 35% x  3,725.00 =  1,303.75       $58,534.75
         *   1040 line 16   the SMALLER                          $55,023.00
         *
         *   THE AMT:
         *   Form 3921      (105.00 - 5.00) x 10,000         $1,000,000.00
         *   6251 line 1b   270,000.00 - 15,750.00             $254,250.00
         *   6251 line 2a   the standard deduction, added back   $15,750.00
         *   6251 line 4    254,250 + 15,750 + 1,000,000     $1,270,000.00
         *   6251 line 5    25% of (1,270,000.00 - 626,350.00) is 160,912.50,
         *                  far above the 88,100.00 exemption         $0.00
         *   6251 line 6    = Part III line 12               $1,270,000.00
         *
         *   PART III:
         *   III 13         QDCGT line 4                        $20,000.00
         *   III 15/16      the QDCGT arm reads line 13 flat    $20,000.00
         *   III 17         1,270,000.00 - 20,000.00         $1,250,000.00
         *   III 18         26% x   239,100.00 =  62,166.00
         *                + 28% x 1,010,900.00 = 283,052.00    $345,218.00
         *   III 20/27      QDCGT line 5                       $234,250.00
         *   III 21         48,350.00 - 234,250.00 is negative        -0-
         *   III 30         the 20,000.00, all at 15%           $20,000.00
         *   III 31         15% x 20,000.00                      $3,000.00
         *   III 38         345,218.00 + 3,000.00              $348,218.00
         *   III 39         26% x   239,100.00 =  62,166.00
         *                + 28% x 1,030,900.00 = 288,652.00    $350,818.00
         *   III 40         the SMALLER                        $348,218.00
         *
         *   6251 line 7    Part III line 40                   $348,218.00
         *   6251 line 10   1040 line 16                        $55,023.00
         *   6251 line 11   348,218.00 - 55,023.00             $293,195.00
         *   1040 line 17   Schedule 2 line 3                  $293,195.00
         *   1040 line 18   55,023.00 + 293,195.00             $348,218.00
         *
         * **What Part III is worth on this return: $2,600.00.** Without it the
         * $20,000.00 of qualified dividends would be charged the AMT's flat 28%
         * ($5,600.00) instead of §1(h)'s 15% ($3,000.00), and the AMT would be
         * $295,795.00. That is the number this leaf's own counterfactual
         * assertion names, derived independently as 13% of $20,000.00.
         */
        theFaangReturnAnIsoSpreadBesideQualifiedDividends: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: [
                    'wages', 'ordinaryDividends', 'qualifiedDividends', 'alternativeMinimumTax',
                ],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-33-faang-w2')('250000.00'),
                ])([])([dividendDocument('sha256-33-faang-div')({
                    box1aTotalOrdinaryDividends: '20000.00',
                    box1bQualifiedDividends: '20000.00',
                })])([])([])([])([])([])([]),
                isoExerciseForms: [{
                    documentHash: 'sha256-33-faang-3921',
                    value: {
                        dialect: 'vnd.fjs.form3921',
                        payerTin: '11-1111111',
                        recipientTin: '222-22-2222',
                        accountNumber: 'ACC-ISO',
                        taxYear: 2025,
                        formRevision: 'April 2025',
                        sourceArtifactHash:
                            'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                        box1DateOptionGranted: '01/03/2023',
                        box2DateOptionExercised: '03/13/2025',
                        box3ExercisePricePerShare: '5.00',
                        box4FairMarketValuePerShareOnExerciseDate: '105.00',
                        box5NumberOfSharesTransferred: '10000',
                    },
                }],
            })
            // THE CRITERION, first: this return COMPUTES. Before TAX-33 the
            // identical inputs produced a refusal naming Part III.
            assert(
                outcome.kind === 'ok',
                ['an ISO spread beside qualified dividends must COMPUTE', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 1a').value, 25000000n, '$250,000.00 of wages')
            assertEq(at('1040 line 3a').value, 2000000n, '$20,000.00 of qualified dividends')
            assertEq(at('1040 line 3b').value, 2000000n, 'and the same in ordinary dividends')
            assertEq(at('1040 line 11b').value, 27000000n, 'AGI = $270,000.00')
            assertEq(at('1040 line 15').value, 25425000n, 'taxable income = $254,250.00')
            assertEq(at('1040 line 16').value, 5502300n, 'the regular tax = $55,023.00')
            assertEq(at('1040 line 17').value, 29319500n, 'the AMT = $293,195.00')
            assertEq(at('1040 line 18').value, 34821800n, '$55,023.00 + $293,195.00 = $348,218.00')
            // 1040 line 18 is Part III's own line 40, because the AMT is the
            // EXCESS over the regular tax and this return's line 10 is exactly
            // 1040 line 16. Asserted as an identity across the two systems.
            assertEq(
                at('1040 line 18').value, 34821800n,
                'and it equals Part III line 40, the AMT being the excess')
            // THE COUNTERFACTUAL, derived independently: 28% - 15% = 13%, and
            // 13% of $20,000.00 is $2,600.00. Taxing the qualified dividends at
            // the flat AMT rate -- which is exactly what Phase 29 refused rather
            // than do -- gives $295,795.00.
            const ifTaxedFlat = 29579500n
            assertEq(
                ifTaxedFlat - 29319500n, 260000n,
                '13% of the $20,000.00 of qualified dividends = $2,600.00, hand-computed')
            assert(
                at('1040 line 17').value !== ifTaxedFlat,
                ['Part III must charge 15% on the qualified dividends, not the AMT\'s 28%',
                    at('1040 line 17').value])
            // Provenance survives Part III: 1040 line 17 still cites the Form
            // 3921 that put the tax there.
            const hashes = at('1040 line 17').sources.map(source => source.documentHash)
            assert(
                hashes.includes('sha256-33-faang-3921'),
                ['1040 line 17 must cite the Form 3921', hashes])
        },
        /**
         * ★ **CRITERION 4 — the cross-check against an INDEPENDENT `qdcgt`
         * call.** The regular tax above and Part III's lines 13/20/27 both read
         * the same worksheet, so an error in that ONE execution would be
         * invisible to every assertion inside the leaf above: the wrong line 16
         * and the wrong Part III would agree with each other.
         *
         * So this leaf runs `qdcgt` itself, on inputs built from the FAANG
         * return's 1040 lines, and asserts that the threaded figures match it —
         * the shape `formEightNineNineFivesNetCapitalGainIsTheWorksheetsOwn`
         * set for Form 8995 line 12. The expected side is a real execution of a
         * module whose own arithmetic is exhaustively proven, driven by inputs
         * this leaf types out, and it is NOT the execution the report used.
         */
        theFaangReturnsWorksheetAgreesWithAnIndependentQdcgt: () => {
            // Hand-typed off the derivation above, never read back off the
            // report: 1040 line 15 and 1040 line 3a.
            const worksheet = qdcgt(taxParams2025)({
                status: 'single',
                line1Cents: 25425000n,
                line2Cents: 2000000n,
                filingScheduleD: false,
                scheduleD15Cents: 0n,
                scheduleD16Cents: 0n,
                line7aCents: 0n,
            })
            assertEq(worksheet.line4, 2000000n, 'QDCGT line 4 = $20,000.00 -- Part III line 13')
            assertEq(worksheet.line5, 23425000n, 'QDCGT line 5 = $234,250.00 -- Part III lines 20/27')
            assertEq(worksheet.line25, 5502300n, 'QDCGT line 25 = $55,023.00 -- 1040 line 16')
            // Part III, run against THIS worksheet's lines rather than the
            // report's, must reproduce the report's own line 7.
            const three = partThree(taxParams2025)({
                status: 'single',
                line12Cents: 127000000n,
                scheduleD19Cents: 0n,
                regularWorksheet: {
                    kind: 'qdcgt',
                    qdcgtLine4Cents: worksheet.line4,
                    qdcgtLine5Cents: worksheet.line5,
                },
            })
            assertEq(three.line40, 34821800n, 'Part III line 40 = $348,218.00')
            // …and the AMT the report printed is that figure less the regular
            // tax this independent worksheet computed. Both sides of the
            // subtraction come from THIS leaf's own executions.
            assertEq(
                three.line40 - worksheet.line25, 29319500n,
                'the AMT on 1040 line 17 = $348,218.00 - $55,023.00 = $293,195.00')
        },
        // THE MUTATION GUARD THIS FIXTURE EXISTS FOR, stated as its own
        // assertion rather than left implicit above.
        //
        // Form 6251 line 2a adds back **1040 line 12e**, the standard
        // deduction — NOT 1040 line 14, the deduction TOTAL. On almost every
        // fixture in this file the two are equal, because lines 13a and 13b
        // are zero, so feeding line 14 to that input survives the whole suite.
        // Here they differ by the $2,700.00 senior deduction, and the
        // difference reaches the tax: 28% of $2,700.00 is $756.00, so the
        // wrong wiring would report $293,235.00 instead of $292,479.00.
        //
        // Both figures are hand-typed, and the assertion is the DIFFERENCE
        // rather than only the right answer, so this leaf says WHAT it is
        // guarding rather than merely repeating the leaf above.
        lineTwoAAddsBackLineTwelveENotLineFourteen: () => {
            const rightAnswer = 29247900n
            const ifLineFourteenWereUsed = 29323500n
            assertEq(
                ifLineFourteenWereUsed - rightAnswer, 75600n,
                '28% of the $2,700.00 senior deduction = $756.00, hand-computed')
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions', 'alternativeMinimumTax'],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-amt-2a-w2')('130000.00'),
                ])([])([])([])([])([])([])([])([]),
                isoExerciseForms: [{
                    documentHash: 'sha256-29-amt-2a-3921',
                    value: {
                        dialect: 'vnd.fjs.form3921',
                        payerTin: '11-1111111',
                        recipientTin: '222-22-2222',
                        accountNumber: 'ACC-ISO',
                        taxYear: 2025,
                        formRevision: 'April 2025',
                        sourceArtifactHash:
                            'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                        box3ExercisePricePerShare: '5.00',
                        box4FairMarketValuePerShareOnExerciseDate: '105.00',
                        box5NumberOfSharesTransferred: '10000',
                    },
                }],
            })
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const seventeen = lineRuled(outcome.lines)('1040 line 17').value
            assertEq(seventeen, rightAnswer, 'line 2a read 1040 line 12e')
            assert(
                seventeen !== ifLineFourteenWereUsed,
                ['line 2a must NOT read 1040 line 14, which includes the senior deduction', seventeen])
        },
        // THE TRIPWIRE, at the entry point: the IDENTICAL return without the
        // declaration refuses, naming Form 6251 and the declaration that fixes
        // it. Without this the engine would emit a confident 1040 understating
        // the tax by $292,479.00 -- the largest silent understatement any
        // tripwire in this engine guards against.
        theSameReturnUndeclaredRefusesAtTheEntryPoint: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions'],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-amt-undeclared-w2')('130000.00'),
                ])([])([])([])([])([])([])([])([]),
                isoExerciseForms: [{
                    documentHash: 'sha256-29-amt-undeclared-3921',
                    value: {
                        dialect: 'vnd.fjs.form3921',
                        payerTin: '11-1111111',
                        recipientTin: '222-22-2222',
                        accountNumber: 'ACC-ISO',
                        taxYear: 2025,
                        formRevision: 'April 2025',
                        sourceArtifactHash:
                            'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                        box3ExercisePricePerShare: '5.00',
                        box4FairMarketValuePerShareOnExerciseDate: '105.00',
                        box5NumberOfSharesTransferred: '10000',
                    },
                }],
            })
            assert(outcome.kind === 'error', ['an undeclared ISO exercise must refuse', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assertEq(outcome.unmodeled[0], 'alternativeMinimumTax', outcome.unmodeled)
            assert(outcome.message.includes('Form 6251'), [outcome.message])
            assert(outcome.message.includes('never received'), [outcome.message])
            assert(outcome.message.includes('declare alternativeMinimumTax'), [outcome.message])
        },
        // CRITERION 5, at the entry point and in the direction that matters:
        // the SAME return with no Form 3921 at all computes exactly what it
        // computed before this phase — the AMT is $0.00, 1040 line 17 is
        // $0.00, and line 18 is the regular tax alone.
        theSameReturnWithNoIncentiveStockOptionAddsNothing: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                taxpayerBornBeforeJan2_1961: true,
                declaredKinds: ['wages', 'seniorAndOtherScheduleOneADeductions'],
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-amt-none-w2')('130000.00'),
                ])([])([])([])([])([])([])([])([]),
            })
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                return
            }
            const at = lineRuled(outcome.lines)
            assertEq(at('1040 line 16').value, 1913900n, 'the same $19,139.00 of regular tax')
            assertEq(at('1040 line 17').value, 0n, 'no alternative minimum tax')
            assertEq(at('1040 line 18').value, 1913900n, 'line 18 is the regular tax alone')
        },
    },
    // ── Phase 29 (TAX-34): the double taxation, PRICED end to end ──────────
    basisCorrection: {
        // THE FIGURE THIS REQUIREMENT EXISTS FOR, computed twice on one
        // fixture: the SAME return with and without the taxpayer's basis
        // correction, and the difference in federal income tax between them.
        //
        // The filer is an ordinary equity-compensated employee. $50,000.00 of
        // salary and $150,000.00 of restricted stock units that vested during
        // the year — all $200,000.00 of it inside Form W-2 box 1, all of it
        // already withheld on. The shares were sold the day they vested, for
        // the $150,000.00 they were worth, so there is no economic gain at
        // all. The broker reports proceeds $150,000.00 and basis $0.00, which
        // is CORRECT by §6045's rules — $0.00 is what the employee paid — and
        // checks box 12, so this is Form 8949 category A.
        //
        // WITH the correction, hand-computed:
        //   Form 8949 col (d)  proceeds                        $150,000.00
        //             col (e)  basis as reported                     $0.00
        //             col (f)  code                                       B
        //             col (g)  0.00 - 150,000.00               ($150,000.00)
        //             col (h)                                          $0.00
        //   Sch D line 16 / 1040 line 7a                              $0.00
        //   1040 line 11b   AGI                                 $200,000.00
        //   1040 line 15    200,000.00 - 15,750.00              $184,250.00
        //   1040 line 16    10% of 11,925.00                      $1,192.50
        //                 + 12% of 36,550.00                      $4,386.00
        //                 + 22% of 54,875.00                     $12,072.50
        //                 + 24% of 80,900.00                     $19,416.00
        //                                                        $37,067.00
        //
        // WITHOUT it, the identical return:
        //   Sch D line 16 / 1040 line 7a                        $150,000.00
        //   1040 line 11b   AGI                                 $350,000.00
        //   1040 line 15    350,000.00 - 15,750.00              $334,250.00
        //   1040 line 16    the four above, plus
        //                   24% of 93,950.00 (to the ceiling)    $22,548.00
        //                 + 32% of 53,225.00                     $17,032.00
        //                 + 35% of 83,725.00                     $29,303.75
        //                   i.e. 1,192.50 + 4,386.00 + 12,072.50
        //                      + 22,548.00 + 17,032.00 + 29,303.75
        //                                                        $86,534.75
        //
        // **$86,534.75 - $37,067.00 = $49,467.75** of federal income tax on
        // $150,000.00 of wages that were already taxed as wages. Neither
        // return refuses; neither looks wrong; every other line agrees. That
        // is the whole of TAX-34.
        theDoubleTaxationIsPricedAtFortyNineThousandFourHundredAndSixtySeven: () => {
            /** @type {ReturnProfile} */
            const profile = {
                ...singleProfile,
                declaredKinds: ['wages', 'capitalGainsOrLosses'],
            }
            /** @type {Stored<OneZeroNineNineB>} */
            const sale = {
                documentHash: 'sha256-29-rsu-1099b',
                value: {
                    dialect: 'vnd.fjs.1099b',
                    payerTin: '77-7777777',
                    recipientTin: '222-22-2222',
                    accountNumber: 'ACC-BROKER',
                    taxYear: 2025,
                    formRevision: '2025',
                    sourceArtifactHash:
                        'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                    box1aDescriptionOfProperty: '1,000 sh MEGACORP',
                    box1dProceeds: '150000.00',
                    box1eCostOrOtherBasis: '0.00',
                    box2ShortTermGainOrLoss: true,
                    box12BasisReportedToIrs: true,
                },
            }
            /** @type {(basisCorrectionForms: readonly Stored<BasisCorrection>[]) => Form1040Inputs} */
            const returnWith = basisCorrectionForms => ({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-rsu-w2')('200000.00'),
                ])([])([])([sale])([])([])([])([])([]),
                basisCorrectionForms,
            })
            const uncorrected = form1040Report(taxParams2025)(returnWith([]))
            assert(uncorrected.kind === 'ok', ['the uncorrected return must COMPUTE, not refuse', uncorrected])
            if (uncorrected.kind !== 'ok') {
                return
            }
            const corrected = form1040Report(taxParams2025)(returnWith([{
                documentHash: 'sha256-29-rsu-fix',
                value: {
                    dialect: 'vnd.fjs.basis_correction',
                    recipientTin: '222-22-2222',
                    taxYear: 2025,
                    brokerageDocumentHash: 'sha256-29-rsu-1099b',
                    correctedCostOrOtherBasis: '150000.00',
                    reason: '1,000 restricted stock units vested at $150.00 and the whole '
                        + '$150,000.00 is inside Form W-2 box 1; the broker reported $0.00 basis '
                        + 'because that is what the employee paid.',
                },
            }]))
            assert(corrected.kind === 'ok', ['expected ok', corrected])
            if (corrected.kind !== 'ok') {
                return
            }
            const before = lineRuled(uncorrected.lines)
            const after = lineRuled(corrected.lines)
            // The wages are identical, which is the point: the $150,000.00 is
            // taxed once here on BOTH returns.
            assertEq(before('1040 line 1a').value, 20000000n, '$200,000.00 of wages')
            assertEq(after('1040 line 1a').value, 20000000n, 'and the same on both')
            // …and a second time, as a capital gain, only on the uncorrected
            // one.
            assertEq(before('1040 line 7a').value, 15000000n, 'a $150,000.00 phantom capital gain')
            assertEq(after('1040 line 7a').value, 0n, 'and none at all, once corrected')
            assertEq(before('1040 line 11b').value, 35000000n, 'AGI $350,000.00')
            assertEq(after('1040 line 11b').value, 20000000n, 'AGI $200,000.00')
            assertEq(before('1040 line 15').value, 33425000n, 'taxable income $334,250.00')
            assertEq(after('1040 line 15').value, 18425000n, 'taxable income $184,250.00')
            assertEq(before('1040 line 16').value, 8653475n, '$86,534.75 of tax')
            assertEq(after('1040 line 16').value, 3706700n, '$37,067.00 of tax')
            // THE PRICE, asserted as its own hand-typed figure rather than
            // only as the two totals: a reader has to be able to see the
            // number this requirement exists to remove.
            const overstatement = before('1040 line 16').value - after('1040 line 16').value
            assertEq(
                overstatement, 4946775n,
                '$49,467.75 of federal income tax on already-taxed wages')
            // Neither return owes alternative minimum tax, so nothing here is
            // an artefact of Phase 29's other half.
            assertEq(before('1040 line 17').value, 0n)
            assertEq(after('1040 line 17').value, 0n)
            // And the corrected return CITES the taxpayer's own document, so
            // the adjustment is attributable rather than anonymous.
            const hashes = after('1040 line 7a').sources.map(source => source.documentHash)
            assert(
                hashes.includes('sha256-29-rsu-fix'),
                ['1040 line 7a must cite the basis correction that moved it', hashes])
        },
        // DOC-23's only reader, at the entry point: a stored Form 3922 plus
        // ANY reported sale refuses the whole return, naming all three gaps.
        // The Form 3922 here is for an unrelated employee stock purchase plan
        // — which is exactly the problem, since nothing establishes whether
        // the shares sold were those shares.
        aStoredFormThreeNineTwoTwoWithASaleRefusesTheWholeReturn: () => {
            /** @type {ReturnProfile} */
            const profile = { ...singleProfile, declaredKinds: ['wages', 'capitalGainsOrLosses'] }
            /** @type {Stored<OneZeroNineNineB>} */
            const sale = {
                documentHash: 'sha256-29-espp-1099b',
                value: {
                    dialect: 'vnd.fjs.1099b',
                    payerTin: '77-7777777',
                    recipientTin: '222-22-2222',
                    accountNumber: 'ACC-BROKER',
                    taxYear: 2025,
                    formRevision: '2025',
                    sourceArtifactHash:
                        'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                    box1dProceeds: '20000.00',
                    box1eCostOrOtherBasis: '17000.00',
                    box2LongTermGainOrLoss: true,
                    box12BasisReportedToIrs: true,
                },
            }
            /** @type {Stored<FormThirtyNineTwentyTwo>} */
            const transfer = {
                documentHash: 'sha256-29-espp-3922',
                value: {
                    dialect: 'vnd.fjs.form3922',
                    payerTin: '11-1111111',
                    recipientTin: '222-22-2222',
                    accountNumber: 'ACC-ESPP',
                    taxYear: 2025,
                    formRevision: 'April 2025',
                    sourceArtifactHash:
                        'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
                    box1DateOptionGranted: '01/01/2025',
                    box2DateOptionExercised: '06/30/2025',
                    box3FairMarketValuePerShareOnGrantDate: '100.00',
                    box4FairMarketValuePerShareOnExerciseDate: '150.00',
                    box5ExercisePricePaidPerShare: '85.00',
                    box6NumberOfSharesTransferred: '117.647058',
                    box7DateLegalTitleTransferred: '06/30/2025',
                    box8ExercisePricePerShareAsIfExercisedOnGrantDate: '85.00',
                },
            }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-espp-w2')('90000.00'),
                ])([])([])([sale])([])([])([])([])([]),
                employeeStockPurchaseForms: [transfer],
            })
            assert(outcome.kind === 'error', ['an ESPP transfer plus a sale must refuse', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assert(outcome.message.includes('sha256-29-espp-3922'), [outcome.message])
            assert(outcome.message.includes('§423(a)(1)'), ['gap 2', outcome.message])
            assert(outcome.message.includes('Form W-2 box'), ['gap 3', outcome.message])
            assertEq(outcome.unmodeled.length, 0, 'a data-sufficiency refusal names no kind')
            // THE CONTROL, in the same leaf: the identical return WITHOUT the
            // sale computes. A Form 3922 arrives in the year of purchase, and
            // in that year there is nothing to report.
            const control = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-espp-w2-control')('90000.00'),
                ])([])([])([])([])([])([])([])([]),
                employeeStockPurchaseForms: [transfer],
            })
            assertEq(control.kind, 'ok', ['an ESPP transfer with no sale must compute', control])
        },
        // A basis correction on a return that never runs Schedule D is an
        // assertion the engine would DROP, and it refuses instead — the guard
        // that lives in this file rather than in `fjs/form8949`, because only
        // this layer knows whether Schedule D will run at all.
        aCorrectionOnAReturnThatDoesNotFileScheduleDRefuses: () => {
            /** @type {ReturnProfile} */
            const profile = { ...singleProfile, declaredKinds: ['wages'] }
            const outcome = form1040Report(taxParams2025)({
                ...inputsOf(storedProfile(profile))([
                    w2Document('sha256-29-no-sched-d-w2')('90000.00'),
                ])([])([])([])([])([])([])([])([]),
                basisCorrectionForms: [{
                    documentHash: 'sha256-29-orphan-fix',
                    value: {
                        dialect: 'vnd.fjs.basis_correction',
                        recipientTin: '222-22-2222',
                        taxYear: 2025,
                        brokerageDocumentHash: 'sha256-29-nowhere',
                        correctedCostOrOtherBasis: '1000.00',
                        reason: 'the return does not declare capitalGainsOrLosses',
                    },
                }],
            })
            assert(outcome.kind === 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                return
            }
            assert(outcome.message.includes('sha256-29-orphan-fix'), [outcome.message])
            assert(
                outcome.message.includes('capitalGainsOrLosses'),
                ['the refusal must name the declaration that fixes it', outcome.message])
            assert(
                outcome.message.includes('silently dropping'),
                ['and say why it refuses rather than ignoring', outcome.message])
        },
    },
}
