/**
 * Form 1040 lines 1a through 15 (TAX-05, first half): income, adjusted gross
 * income, the standard deduction, and taxable income — every line a
 * {@link ReportLine} citing the documents it derived from (ROADMAP criterion
 * 1).
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
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { applyWholeDollarElection } from '../../report/line/module.f.js'
import { dialect as w2Dialect } from '../../document/w2/module.f.js'
import { dialect as oneZeroNineNineIntDialect } from '../../document/1099int/module.f.js'
import {
    dialect as returnProfileDialect,
    validate as validateReturnProfile,
} from '../../return/profile/module.f.js'
import { standardDeductionCents } from '../../tax/deduction/module.f.js'
import { individualFilingStatuses, taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { IndividualFilingStatus, TaxParamSet } from '../../tax/params/module.f.js' */

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
 * exactly one); W-2s and 1099-INTs are lists, because a taxpayer may hold any
 * number of each — which is precisely what makes criterion 5's ten-document
 * rounding demonstration expressible on a real line.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly w2s: readonly Stored<W2>[],
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
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
 * printed line label.
 * @typedef {{
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
 * }} Form1040IncomeLines
 */

/**
 * Computes Form 1040 lines 1a through 15 for an in-scope return.
 *
 * Every `1b`-`1i`, `3a`-`8`, `10`, `13a` and `13b` line is a
 * {@link profileDeclaredZeroLine}: zero only because the corresponding kind
 * was not declared. Had it been declared, `fjs/return/scope` would already
 * have refused the whole report, so "declared but unmodeled" never reaches
 * this function.
 *
 * `taxParamSet` is read by exactly one line — 12e, the standard deduction. It
 * is threaded through the outer arrow rather than looked up here, so the tax
 * year in force is the caller's decision and never an implicit default.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form1040Inputs) => Form1040IncomeLines}
 */
export const form1040IncomeLines = taxParamSet => inputs => {
    const { profile, w2s, interestForms } = inputs
    const declaredZero = profileDeclaredZeroLine(profile)
    const fromDocuments = documentLine(profile)

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

    const line3a = declaredZero('1040 line 3a') // qualified dividends
    const line3b = declaredZero('1040 line 3b') // ordinary dividends
    const line4a = declaredZero('1040 line 4a') // IRA distributions
    const line4b = declaredZero('1040 line 4b') // IRA taxable amount
    const line5a = declaredZero('1040 line 5a') // pensions and annuities
    const line5b = declaredZero('1040 line 5b') // pensions taxable amount
    const line6a = declaredZero('1040 line 6a') // social security benefits
    const line6b = declaredZero('1040 line 6b') // social security taxable amount
    const line7a = declaredZero('1040 line 7a') // capital gain or (loss)
    const line8 = declaredZero('1040 line 8')   // additional income, Schedule 1

    // 9 — total income. The eight summands the printed form names, in its
    // order; the sources are the union of all eight.
    const line9 = totalLine('1040 line 9')([
        line1z, line2b, line3b, line4b, line5b, line6b, line7a, line8,
    ])
    const line10 = declaredZero('1040 line 10') // adjustments, Schedule 1

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

    // 12e — the standard deduction.
    //
    // Research found that PROV-01's `ReportLine` could not express this line
    // AT ALL: `sources` is a non-empty tuple of `{documentHash, boxPath,
    // value}`, and the standard deduction derives from a filing status and a
    // set of checked boxes, which no document dialect modelled. The return
    // profile (10-CONTEXT.md Decision 4) is what fixes that — it is a real CAS
    // document with a real hash, so line 12e cites the profile's own
    // `filingStatus` box and one box per checked 12d checkbox. Phase 9's
    // `tsc`-level guarantee is left untouched rather than widened, and no
    // synthetic hash is minted.
    const status = storedFilingStatusNamed(profile.value.filingStatus)
    assert(
        status !== undefined,
        [
            'the return profile carries a filing status this engine has no parameters for',
            profile.value.filingStatus,
        ],
    )
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
    /**
     * The filing-status box, then one box per CHECKED 12d checkbox. Annotated
     * as the non-empty tuple `ReportLine.sources` demands: a spread of a plain
     * array into an array literal infers a plain array, and the head element
     * is what makes the tuple non-empty.
     * @type {readonly [Source, ...(readonly Source[])]}
     */
    const twelveESources = [filingStatusSource, ...twelveDBoxSources]
    const line12e = {
        value: standardDeductionCents(taxParamSet)({
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
        }),
        sources: twelveESources,
        rule: '1040 line 12e',
    }
    const line13a = declaredZero('1040 line 13a') // QBI deduction, Form 8995
    // 13b — additional deductions from Schedule 1-A. For a profile that
    // declares `seniorAndOtherScheduleOneADeductions`, this line is NOT
    // legitimately zero: the OBBBA enhanced deduction for seniors is
    // MANDATORY, not elective, so a zero here would understate the deduction
    // and overstate the tax. That is exactly why the kind is unmodeled in
    // `fjs/return/scope` and refuses the WHOLE report. Within scope the kind
    // is undeclared, and only then is the zero honest.
    const line13b = declaredZero('1040 line 13b')
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
const expectedLineCount = 31

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
 * The 1099-INT money boxes lines 2a and 2b read. A box the fixture OMITS is
 * absent in the DOC-11 sense — the point of the absent-box leaf.
 * @typedef {{
 *   readonly box1InterestIncome?: string,
 *   readonly box3UsSavingsBondsAndTreasuryInterest?: string,
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

/**
 * Assembles the three input lists into a {@link Form1040Inputs}.
 * @type {(profile: Stored<ReturnProfile>) => (w2s: readonly Stored<W2>[]) => (interestForms: readonly Stored<OneZeroNineNineInt>[]) => Form1040Inputs}
 */
const inputsOf = profile => w2s => interestForms => ({ profile, w2s, interestForms })

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
const linesForProfile = value => form1040IncomeLines(taxParams2025)(
    inputsOf(storedProfile(value))([])([]))

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
            const lines = form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
                w2Document('sha256-w2-02')('25000.00'),
            ])([]))
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
            const lines = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([]))
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
            const lines = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({
                        box1InterestIncome: '100.00',
                        box3UsSavingsBondsAndTreasuryInterest: '25.00',
                    }),
                ]))
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
            const lines = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({ box1InterestIncome: '100.00' }),
                ]))
            assertEq(lines.line2b.value, 10000n)
            assertEq(lines.line2b.sources.length, 1)
            const [only] = lines.line2b.sources
            assertEq(only.boxPath, 'box1InterestIncome')
        },
        // The control for the box-8 mapping: tax-exempt interest is line 2a,
        // and it does not leak into 2b.
        taxExemptInterestIsLineTwoANotTwoB: () => {
            const lines = form1040IncomeLines(taxParams2025)(
                inputsOf(storedProfile(singleProfile))([])([
                    interestDocument('sha256-int-01')({
                        box1InterestIncome: '100.00',
                        box8TaxExemptInterest: '7.00',
                    }),
                ]))
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
            const lines = form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
                w2Document('sha256-w2-02')('25000.00'),
            ])([
                interestDocument('sha256-int-01')({
                    box1InterestIncome: '100.00',
                    box3UsSavingsBondsAndTreasuryInterest: '25.00',
                }),
            ]))
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
            const lines = form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
            ])([]))
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
            const lines = form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('50000.00'),
            ])([]))
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
            const lines = form1040IncomeLines(taxParams2025)(inputsOf(storedProfile(singleProfile))([
                w2Document('sha256-w2-01')('5000.00'),
            ])([]))
            assertEq(lines.line11b.value, 500000n)
            assertEq(lines.line14.value, 1575000n)
            assertEq(lines.line15.value, 0n)
            assert(lines.line15.value >= 0n, ['taxable income must never be negative', lines.line15.value])
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
        const { line2b } = form1040IncomeLines(taxParams2025)(
            inputsOf(profile)([])(tenInterestDocumentsAtOneThirtyNine))
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
                    form1040IncomeLines(taxParams2025)(
                        inputsOf(profile)([])([document])).line2b,
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
        const lines = form1040IncomeLines(taxParams2025)(
            inputsOf(storedProfile(singleProfile))([])([]))
        const entries = Object.entries(lines)
        assertEq(
            entries.length,
            expectedLineCount,
            ['expected exactly the independently-stated printed line count', entries.length],
        )
        for (const [name, line] of entries) {
            assert(line.sources.length > 0, ['a line with no citation is a silently omitted line', name])
            assert(line.rule !== '', ['a line must name the rule it implements', name])
        }
    },
}
