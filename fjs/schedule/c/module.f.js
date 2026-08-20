/**
 * Schedule C (Form 1040) — TAX-30: *Profit or Loss From Business (Sole
 * Proprietorship)*, every printed part addressed, one named pure function per
 * printed line group (TAX-15).
 *
 * Source, transcribed from the printed 2025 `f1040sc.pdf` face: Part I
 * (Income, lines 1-7), Part II (Expenses, lines 8-32), Part III (Cost of Goods
 * Sold, lines 33-42), Part IV (Information on Your Vehicle, lines 43-47) and
 * Part V (Other Expenses, line 48).
 *
 * This is a STANDALONE, independently callable pure function over the declared
 * return profile and stored documents alone — the same relationship
 * `fjs/schedule/b`, `fjs/schedule/a`, `fjs/schedule/1a` and `fjs/schedule/1`
 * have to their own inputs. It imports NOTHING at runtime from
 * `fjs/return/scope` or `fjs/form1040/`.
 *
 * ## The Out-of-Scope entry this module reverses, which is worth reading first
 *
 * REQUIREMENTS.md carried, from 2026-08-03 until 2026-08-15, the entry
 * *"1099-NEC and self-employment — the three-box simplicity is a trap; the
 * downstream is Schedule C / SE / QBI."* It is struck through rather than
 * deleted, because **it was right**. `fjs/document/1099nec` really is a
 * morning's work; this file is not, and the two forms it could not reach when
 * it was written — Schedule SE and Form 8995 — were named in refusals
 * throughout rather than quietly skipped. **Phase 28 built both**
 * (`fjs/schedule/se`, `fjs/form8995`), so this module's own §1402(b)(2)
 * refusal is gone and the only refusals left here are Schedule C's own.
 *
 * ## WHAT COMPUTES AND WHAT REFUSES, in one table
 *
 * | Printed | Computes? | From / why not |
 * |---|---|---|
 * | 1 gross receipts | ✔ | `vnd.fjs.1099nec` box 1, gated on the taxpayer's own `grossReceiptsFullyReportedOnForms1099Nec` assertion |
 * | 2 returns and allowances | documented zero | nothing reports or asserts it; a zero here OVERSTATES income |
 * | 3, 5, 7 | ✔ | arithmetic on the above |
 * | 4 cost of goods sold | documented zero, and REFUSES if asserted | Part III |
 * | 6 other income | documented zero | the fuel tax credit and refunds this engine does not model |
 * | 8, 10, 11, 14, 15, 16a, 16b, 17, 18, 20a, 20b, 21, 22, 23, 24a, 25, 26, 27a | ✔ | `vnd.fjs.business_expenses` entries, one category per printed line |
 * | 9 car and truck | REFUSES by name | needs mileage (standard rate) or Part IV + Form 4562 Part V (actual) — and Part V refuses, §274(d)/§280F |
 * | 12 depletion | REFUSES by name | §611 needs a multi-year property basis |
 * | 13 depreciation and §179 | ✔ | `vnd.fjs.asset_register` -> `fjs/form4562` line 22 (a STORED entry in this category still refuses — it would double the figure) |
 * | 19 pension and profit-sharing | REFUSES by name | nothing distinguishes an employee's from the proprietor's |
 * | 24b deductible meals | REFUSES by name | the printed line takes an amount §274(n) has already limited |
 * | 27b | documented zero | the printed form reserves it |
 * | 28, 29 | ✔ | arithmetic |
 * | 30 business use of home | documented zero, and REFUSES if asserted | Form 8829 or the simplified method's square footage |
 * | 31 net profit | ✔ **any profit, and a break-even zero**; REFUSES a loss | see "The net-loss decision" |
 * | 32 at risk | never reached | it exists only for a loss, which refuses |
 * | Part III (33-42) | REFUSES by name | beginning and ending inventory |
 * | Part IV (43-47) | REFUSES by name | it exists only to support line 9, which refuses |
 * | Part V (48) | ✔ | it IS the `otherExpenses` category, totalled to line 27a |
 *
 * ## The net-loss decision, which is the sharpest correctness question here
 *
 * **A net loss on line 31 is REFUSED by name. A profit, and a break-even zero,
 * compute.**
 *
 * The printed page forces this, and it does so in one sentence: *"If a loss,
 * you must go to line 32."* Line 32 is the at-risk determination, and this
 * engine cannot make it — §465 basis in the activity is a multi-year history
 * no document here holds, and checking box 32b requires Form 6198, at which
 * point *"your loss may be limited."* Two further limitations stand behind it,
 * either of which can reduce an allowed loss to less than the arithmetic:
 *
 * - **§469, the passive activity loss rules.** A proprietor who does not
 *   materially participate has a passive loss, deductible only against passive
 *   income, on Form 8582.
 * - **§461(l), the excess business loss limitation.** Above an indexed
 *   threshold the excess is disallowed for the year and becomes a net
 *   operating loss carryforward, on Form 461.
 *
 * So the arithmetic loss is an UPPER BOUND on the deductible loss, never the
 * deductible loss itself. Letting it flow to Schedule 1 line 3 would deduct
 * more than the law allows, understating tax — the direction TAX-16 exists to
 * prevent — and it would do so while moving AGI, and with it the 7.5% medical
 * floor, Schedule 1-A's senior-deduction phase-out, Form 8960's §1411
 * threshold, the Social Security Benefits Worksheet and every credit Phases 24
 * and 25 wired. One unchecked figure, six wrong answers downstream.
 *
 * The alternative — computing the loss and refusing only when one of the three
 * limitations bites — is not available, because deciding whether any of them
 * bites is precisely what this engine cannot do. A refusal that fires only
 * when the engine knows it should is not a guard.
 *
 * So {@link atRiskDeterminationLine32} is a real named function that always
 * refuses, and it is reached exactly when the printed form says to reach it.
 * That is not a placeholder: it is the printed line, implemented, returning
 * the only honest answer this engine has for it.
 *
 * ## One Schedule C per BUSINESS, and a second one refuses
 *
 * Schedule C is filed per business. One `vnd.fjs.business_expenses` document
 * is one business (that dialect's own header records the cardinality), so a
 * return carrying two of them is a return with two Schedule Cs — two line 31s,
 * two at-risk determinations, two home-office allocations. This engine
 * supports exactly ONE and refuses a second by name, quoting both
 * `principalBusiness` strings.
 *
 * **It does not merge them.** Merging is not an approximation of two Schedule
 * Cs; it is a third, different return, and its single line 31 would net one
 * business's loss against the other's profit without either at-risk
 * determination — which is the specific arithmetic §465 exists to stop.
 *
 * ## The category vocabulary is TOTAL by `tsc`, not by discipline
 *
 * `vnd.fjs.business_expenses` keeps `category` a free string, exactly as
 * `vnd.fjs.itemized_deductions` keeps `lineTag` one, and for the same stated
 * reason: deciding which printed line a payment belongs on is deduction logic.
 * This module is that logic, and it owns the vocabulary — with one difference
 * from `fjs/schedule/a`'s own `knownLineTags`, which is a bare hand-typed
 * list.
 *
 * {@link expenseCategoryLine} is typed `Record<ExpenseCategory,
 * PrintedExpenseLine>`, and both sides of that type are derived from the
 * tuples below. So:
 *
 * - a category in {@link computedExpenseCategories} or
 *   {@link refusedExpenseCategories} with no entry in the map is **TS2741**,
 *   a missing property — not a silently dropped expense;
 * - an entry in the map for a category that is in neither tuple is **TS2353**,
 *   an excess property;
 * - a category mapped to a line number the printed form does not carry is
 *   **TS2322**, because {@link printedExpenseLines} is where those come from.
 *
 * Three compile errors where `fjs/schedule/a` has a runtime list, and the
 * reason for the difference is that this vocabulary is twenty-five entries
 * wide rather than twelve, split across two tables, and the failure mode of
 * getting it wrong is an expense that vanishes rather than one that refuses.
 *
 * The runtime check is still needed and still here: a STORED blob may carry
 * any string at all, and {@link scheduleC} refuses an unrecognized one by
 * name, quoting the category and the entry it came from.
 *
 * ## Line 1's statutory-employee checkbox, and why an untouched W-2 box now
 * refuses a return that used to compute
 *
 * Printed line 1 reads *"check the box if this income was reported to you on
 * Form W-2 and the 'Statutory employee' box on that form was checked."*
 * `vnd.fjs.w2` has modeled `box13StatutoryEmployee` since it was written, and
 * until this phase **nothing anywhere in `fjs/` read it**.
 *
 * That was harmless only while Schedule C did not exist. It is not harmless
 * now: a statutory employee's box 1 wages belong on Schedule C LINE 1, not on
 * 1040 line 1a, precisely so that their business expenses can be deducted
 * against them. This engine puts those wages on line 1a, where no expense can
 * reach them, so it OVERSTATES a statutory employee's income by the whole of
 * their Part II. It also cannot be fixed by reading the box here alone, since
 * the same amount would then have to LEAVE 1040 line 1a.
 *
 * So {@link scheduleC} refuses, unconditionally, on any stored W-2 with that
 * box checked — before the business-record checks, because the refusal holds
 * whether or not the taxpayer also has a `vnd.fjs.business_expenses` record.
 * A statutory employee with no business record at all is exactly the case that
 * would otherwise stay silently overstated.
 *
 * ## Line 31's OTHER printed destination, and the refusal that is no longer
 * here
 *
 * Line 31's own instruction is *"enter on both Schedule 1 (Form 1040), line 3,
 * **and on Schedule SE, line 2**."* Phase 27 reached the first and not the
 * second, and it could not simply leave the gap: the scope guard only refuses
 * a kind the taxpayer DECLARES, and self-employment tax is not elective, so a
 * filer who declared `businessIncomeOrLoss` and nothing else would have
 * received a complete-looking 1040 with Schedule 2 line 4 at zero —
 * understating tax by roughly 15.3% of 92.35% of their net profit, about
 * $7,000 on a $50,000 profit. So `selfEmploymentTaxReachIsUnmodeled` refused
 * every net profit at or above §1402(b)(2)'s $400, and this section recorded
 * the consequence: *"until Phase 28, the only Schedule C this engine will put
 * on a 1040 is one whose net profit is under $400."*
 *
 * **Phase 28 (TAX-31/TAX-32) removed that ceiling, and the function with it.**
 * `fjs/schedule/se` computes Schedule SE, its line 12 reaches Schedule 2 line
 * 4 and its line 13 reaches Schedule 1 line 15; `fjs/form8995` computes the
 * §199A deduction on 1040 line 13a. Line 31 now reaches BOTH of its printed
 * destinations, and the $400 question is asked exactly once, on the form that
 * prints it — applied to §1402(a)(12)'s net EARNINGS rather than to net
 * profit, which is what this module could not do without starting Schedule SE.
 *
 * The one thing this module lost with that function is its `TaxParamSet`: see
 * {@link scheduleC}, which now takes none, because not one figure on the
 * printed Schedule C is indexed, statutory or a rate.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { formFortyFiveSixtyTwo } from '../../form4562/module.f.js'
import { depreciableAssets } from '../../document/asset_register/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { AssetRegister } from '../../document/asset_register/module.f.js' */
/** @import { RentalProperty } from '../../document/rental_property/module.f.js' */
/** @import { Form4562Lines } from '../../form4562/module.f.js' */
/** @import { OneZeroNineNineNec } from '../../document/1099nec/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */


// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/1`'s own
 * `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * One `vnd.fjs.business_expenses` entry paired with the hash of the document
 * it came from — `fjs/schedule/a`'s own flattening shape.
 * @typedef {{ readonly documentHash: string, readonly value: BusinessExpenses['entries'][number] }} StoredEntry
 */

// ── The printed lines an expense category can land on ────────────────────────

/**
 * Every printed Schedule C line number an expense category can land on, read
 * off the 2025 form face in the form's own order.
 *
 * **Twenty-five, and the count is not Part II's.** Twenty-three are Part II's
 * own expense lines, 8 through 27a — the exact range printed line 28 says to
 * add. The other two are outside that range on purpose:
 *
 * - **`'4'`** is Part I's cost of goods sold, which the printed form fills
 *   from Part III line 42 rather than from an expense line. A taxpayer's
 *   assertion of a cost of goods sold has to land SOMEWHERE nameable, and this
 *   is the line it would land on.
 * - **`'30'`** is business use of the home, printed inside Part II but
 *   deliberately excluded from line 28's addition — line 28 is *"total
 *   expenses BEFORE expenses for business use of home"*, and line 30 is
 *   subtracted later, at line 29's tentative profit. Modeling it inside the
 *   line-28 block would deduct it twice.
 *
 * `'27b'` is absent: the printed form reserves it with no box to fill, so no
 * category can name it. It is still modeled as a documented zero on the Part
 * II record, for line-number completeness, exactly as `fjs/schedule/1` models
 * its own reserved line 22.
 */
export const printedExpenseLines = /** @type {const} */ ([
    '4',
    '8', '9', '10', '11', '12', '13', '14', '15', '16a', '16b', '17', '18',
    '19', '20a', '20b', '21', '22', '23', '24a', '24b', '25', '26', '27a',
    '30',
])

/** One printed Schedule C line an expense category can land on.
 * @typedef {typeof printedExpenseLines[number]} PrintedExpenseLine
 */

// ── The category vocabulary, in two tables ───────────────────────────────────

/**
 * The expense categories this engine COMPUTES, one per printed line, in the
 * printed form's own order. Eighteen of the twenty-five.
 *
 * The names are the printed labels, camel-cased — never invented. Where the
 * printed label carries a qualification that changes what belongs on the line
 * (`Insurance (other than health)`, `Supplies (not included in Part III)`,
 * `Employee benefit programs (other than on line 19)`), the qualification is
 * in the label below rather than only in the name, because it is the part a
 * taxpayer categorizing an expense actually needs.
 */
export const computedExpenseCategories = /** @type {const} */ ([
    { category: 'advertising', label: 'Advertising' },
    { category: 'commissionsAndFees', label: 'Commissions and fees' },
    { category: 'contractLabor', label: 'Contract labor (see the Schedule C instructions)' },
    { category: 'employeeBenefitPrograms', label: 'Employee benefit programs (other than on line 19)' },
    { category: 'insuranceOtherThanHealth', label: 'Insurance (other than health)' },
    { category: 'mortgageInterest', label: 'Interest: mortgage (paid to banks, etc.)' },
    { category: 'otherInterest', label: 'Interest: other' },
    { category: 'legalAndProfessionalServices', label: 'Legal and professional services' },
    { category: 'officeExpense', label: 'Office expense' },
    { category: 'rentOrLeaseVehiclesMachineryEquipment', label: 'Rent or lease: vehicles, machinery and equipment' },
    { category: 'rentOrLeaseOtherBusinessProperty', label: 'Rent or lease: other business property' },
    { category: 'repairsAndMaintenance', label: 'Repairs and maintenance' },
    { category: 'supplies', label: 'Supplies (not included in Part III)' },
    { category: 'taxesAndLicenses', label: 'Taxes and licenses' },
    { category: 'travel', label: 'Travel' },
    { category: 'utilities', label: 'Utilities' },
    { category: 'wages', label: 'Wages (less employment credits)' },
    { category: 'otherExpenses', label: 'Other expenses (from Part V line 48)' },
])

/** One category this module computes a printed line for.
 * @typedef {typeof computedExpenseCategories[number]['category']} ComputedExpenseCategory
 */

/**
 * The expense categories this engine REFUSES by name, each naming the form or
 * the facts that would supply the line. Seven of the twenty-five.
 *
 * Every one of these is a line a real sole proprietor plausibly has, and that
 * is the point: a refusal a taxpayer never triggers proves nothing. A stored
 * entry in any of these categories stops the whole return, naming the printed
 * line, the printed label and what is missing — never dropping the amount and
 * computing a Schedule C that is short by it.
 */
export const refusedExpenseCategories = /** @type {const} */ ([
    {
        category: 'costOfGoodsSold',
        label: 'Cost of goods sold (from Part III line 42)',
        remedy: 'requires Part III (lines 33-42), whose line 35 beginning inventory and line 41 '
            + 'ending inventory are values no document this engine holds reports and which no '
            + 'default can stand in for — a zero beginning inventory is a claim about the prior '
            + 'year, not an absence of information. §471 and §263A also decide how those values '
            + 'are computed (no phase yet)',
    },
    {
        category: 'carAndTruck',
        label: 'Car and truck expenses',
        remedy: 'the standard mileage rate needs the business miles driven, which no document '
            + 'this engine models reports and which `vnd.fjs.business_expenses` does not carry; '
            + 'the actual-expense method needs Part IV (lines 43-47) and Form 4562. Form 4562 '
            + 'now EXISTS here, and it refuses this case by name for its own reason: a vehicle is '
            + 'LISTED PROPERTY, so it belongs in Part V, where line 24a asks whether there is '
            + 'evidence supporting the business-use percentage and line 24b whether that evidence '
            + 'is written — §274(d) substantiation no record here carries — and §280F caps a '
            + 'passenger automobile at a per-year dollar table. Neither method is supported, so '
            + 'this engine will not deduct a vehicle expense it cannot substantiate either way '
            + '(no phase yet)',
    },
    {
        category: 'depletion',
        label: 'Depletion',
        remedy: 'requires the §611 depletion allowance, whose cost-depletion basis and remaining '
            + 'recoverable units are a property history spanning years — this engine holds one '
            + 'tax year (no phase yet)',
    },
    {
        category: 'depreciationAndSection179',
        label: 'Depreciation and section 179 expense deduction',
        remedy: 'this line is now COMPUTED, from a vnd.fjs.asset_register document through Form '
            + '4562 line 22 — so a hand-entered total in this category is refused because it '
            + 'would be counted TWICE, once from the register and once here. Record each '
            + 'depreciable asset in the register instead: its description, the month and year it '
            + 'was placed in service, its cost or other basis, its business-use percentage, its '
            + 'classification, method and convention, and its §168(k) status. What Form 4562 '
            + 'still refuses is Part I (any §179 election, because line 11’s business income '
            + 'limitation and line 13’s carryover to next year are both outside one tax year), a '
            + 'CURRENT-year §168(k) allowance, and Part V listed property',
    },
    {
        category: 'pensionAndProfitSharingPlans',
        label: 'Pension and profit-sharing plans',
        remedy: 'nothing in this record distinguishes a contribution made for an EMPLOYEE, which '
            + 'belongs on this line, from one made for the PROPRIETOR, which belongs on Schedule '
            + '1 line 16 and is itself refused because the Pub. 560 limit depends on net '
            + 'self-employment earnings this engine does not compute. Deducting one as the other '
            + 'would put it on the wrong line or count it twice (no phase yet)',
    },
    {
        category: 'deductibleMeals',
        label: 'Deductible meals',
        remedy: 'the printed line asks for an amount the taxpayer has ALREADY limited under '
            + '§274(n), and this engine will not deduct a figure whose limit it did not apply: '
            + 'the 50% rule, the exceptions that restore 100%, and the business-purpose and '
            + 'who-was-present tests all turn on facts about each meal that no record here '
            + 'carries (no phase yet)',
    },
    {
        category: 'businessUseOfHome',
        label: 'Expenses for business use of your home',
        remedy: 'requires Form 8829, or the simplified method’s square footage of the home '
            + 'and of the part used regularly and exclusively for business — this record '
            + 'carries neither, and the simplified method additionally caps the deduction at line '
            + '29’s tentative profit (no phase yet)',
    },
])

/** One category this module refuses by name.
 * @typedef {typeof refusedExpenseCategories[number]['category']} RefusedExpenseCategory
 */

/** Every category this module RECOGNIZES, computed or refused.
 * @typedef {ComputedExpenseCategory | RefusedExpenseCategory} ExpenseCategory
 */

/**
 * **The mapping, mechanical and TOTAL.** Every recognized category to the
 * printed Schedule C line it lands on.
 *
 * `Record<ExpenseCategory, PrintedExpenseLine>` is the whole mechanism, and
 * this module's own docstring spells out the three compile errors it produces.
 * The short version: a category that maps nowhere does not compile, so it
 * cannot become an expense that silently vanishes.
 *
 * The mapping is a BIJECTION — twenty-five categories onto twenty-five printed
 * lines, each line used exactly once — which `theMappingIsABijectionOntoThe\
 * PrintedLines` checks. `tsc` cannot: `Record` guarantees totality on the
 * domain, and says nothing about the codomain, so two categories mapping to
 * one line would compile happily and quietly merge two printed lines into one.
 * @type {Record<ExpenseCategory, PrintedExpenseLine>}
 */
export const expenseCategoryLine = {
    costOfGoodsSold: '4',
    advertising: '8',
    carAndTruck: '9',
    commissionsAndFees: '10',
    contractLabor: '11',
    depletion: '12',
    depreciationAndSection179: '13',
    employeeBenefitPrograms: '14',
    insuranceOtherThanHealth: '15',
    mortgageInterest: '16a',
    otherInterest: '16b',
    legalAndProfessionalServices: '17',
    officeExpense: '18',
    pensionAndProfitSharingPlans: '19',
    rentOrLeaseVehiclesMachineryEquipment: '20a',
    rentOrLeaseOtherBusinessProperty: '20b',
    repairsAndMaintenance: '21',
    supplies: '22',
    taxesAndLicenses: '23',
    travel: '24a',
    deductibleMeals: '24b',
    utilities: '25',
    wages: '26',
    otherExpenses: '27a',
    businessUseOfHome: '30',
}

/**
 * {@link computedExpenseCategories}' names alone, widened to plain strings so
 * the membership question can be asked of the `string` a JSON blob's field
 * actually is — an ordinary widening ASSIGNMENT, never a cast, the same device
 * `fjs/return/scope`'s `modeledKindNames` uses.
 * @type {readonly string[]}
 */
const computedCategoryNames = computedExpenseCategories.map(c => c.category)

// ── Local helpers (reimplemented, not imported from `fjs/form1040/core`) ──────

/**
 * A line that is zero because the taxpayer declared no such income or expense,
 * citing the return profile's own `declaredKinds` box — mirrors
 * `fjs/schedule/1`'s own `profileDeclaredZeroLine`, reimplemented locally per
 * this tree's "reimplement an idiom you cannot import" precedent.
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

/** One `(documentHash, boxPath)` pair as a dedup key.
 * @type {(source: Source) => string}
 */
const sourceKey = source => `${source.documentHash} ${source.boxPath}`

/**
 * The union of every input line's sources: concatenated, deduplicated on
 * {@link sourceKey}, first-seen order, still a non-empty tuple.
 * @type {(lines: readonly ReportLine[]) => readonly [Source, ...(readonly Source[])]}
 */
const unionSources = lines => {
    const concatenated = lines.flatMap(line => line.sources)
    const deduplicated = concatenated.filter((source, index) =>
        concatenated.findIndex(seen => sourceKey(seen) === sourceKey(source)) === index)
    const [first, ...rest] = deduplicated
    assert(
        first !== undefined,
        ['a union of non-empty source tuples cannot be empty', lines.length],
    )
    return [first, ...rest]
}

/**
 * Sums a set of {@link ReportLine}s into one, with a unioned `sources` and its
 * own `rule`.
 * @type {(rule: string) => (lines: readonly ReportLine[]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

/**
 * A line whose value is the DIFFERENCE of two lines, citing both. The printed
 * Schedule C subtracts on lines 3, 5, 29 and 31, and each of those is a rule
 * rather than an aggregation, so it is written here once rather than four
 * times.
 * @type {(rule: string) => (minuend: ReportLine) => (subtrahend: ReportLine) => ReportLine}
 */
const differenceLine = rule => minuend => subtrahend => ({
    value: minuend.value - subtrahend.value,
    sources: unionSources([minuend, subtrahend]),
    rule,
})

/**
 * A line built from real document readings, falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied one — mirrors
 * `fjs/schedule/1`'s own `documentLine`. This is what makes "the hard zero is
 * replaced, not supplemented" true of every line below that reads a document.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (value: bigint) => (sources: readonly Source[]) => ReportLine}
 */
const documentLine = profile => rule => value => sources => {
    const [first, ...rest] = sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value, sources: [first, ...rest], rule }
}

// ── Refusals ─────────────────────────────────────────────────────────────────

/**
 * A case this module will not compute — the same shape `fjs/schedule/1`,
 * `fjs/schedule/a`, `fjs/schedule/d` and `fjs/form8889` already return, so
 * `fjs/form1040/core` threads it through its existing error arm with no new
 * mechanism. No `unmodeled` field: every refusal here is document-data
 * sufficiency (12.1-CONTEXT.md Decision 2.6's category), never an
 * `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleCRefusal
 */

// ── Part I: Income (lines 1-7) ───────────────────────────────────────────────

/**
 * Part I's seven printed lines.
 * @typedef {{
 *   readonly line1: ReportLine, readonly line2: ReportLine, readonly line3: ReportLine,
 *   readonly line4: ReportLine, readonly line5: ReportLine, readonly line6: ReportLine,
 *   readonly line7: ReportLine,
 * }} ScheduleCPartI
 */

/**
 * **Line 1, gross receipts or sales**: the sum of box 1 across every stored
 * `vnd.fjs.1099nec`, citing ONE source per document.
 *
 * The caller has already refused a business record that does not assert
 * `grossReceiptsFullyReportedOnForms1099Nec`, so by the time this runs the
 * taxpayer has affirmed that these forms are the whole of their receipts. That
 * ordering is deliberate and is the only reason this function may be a bare
 * sum: §6041A's $600 trade-or-business filing threshold means a sum over
 * Forms 1099-NEC is otherwise a LOWER BOUND on gross receipts, not gross
 * receipts. `fjs/document/business_expenses`' own header carries the argument.
 * @type {(profile: Stored<ReturnProfile>) => (forms: readonly Stored<OneZeroNineNineNec>[]) => ReportLine}
 */
export const grossReceiptsLine1 = profile => forms => {
    const rule = 'Schedule C line 1 (gross receipts or sales)'
    const sources = forms.flatMap(form => {
        const printed = form.value.box1NonemployeeCompensation
        return printed === undefined
            ? []
            : [{
                documentHash: form.documentHash,
                boxPath: 'box1NonemployeeCompensation',
                value: printed,
            }]
    })
    const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
    return documentLine(profile)(rule)(value)(sources)
}

/**
 * Schedule C Part I — Income, lines 1 through 7.
 *
 * Three of the seven are documented zeros, and each overstates income rather
 * than understating it, which is why each is a zero rather than a refusal:
 *
 * - **Line 2, returns and allowances.** No information return reports a refund
 *   a proprietor gave a customer, and `vnd.fjs.business_expenses` does not
 *   assert one — it is an EXPENSE record, and a return of merchandise is not
 *   an expense, it is negative revenue. A zero here makes line 3 larger.
 * - **Line 4, cost of goods sold.** Part III is refused, and the refusal fires
 *   on an ASSERTED cost of goods sold. A proprietor who asserts none gets a
 *   zero, which makes line 5 larger.
 * - **Line 6, other income.** The printed caption names the federal and state
 *   gasoline or fuel tax credit or refund, which this engine does not model
 *   (`federalFuelTaxCredit` is an `fjs/return/scope` refusal one schedule
 *   over). A zero here makes line 7 smaller — the ONE of the three that
 *   understates, and it understates by an amount the taxpayer would have to
 *   have claimed a fuel credit to have at all.
 * @type {(profile: Stored<ReturnProfile>) => (forms: readonly Stored<OneZeroNineNineNec>[]) => ScheduleCPartI}
 */
export const scheduleCPartI = profile => forms => {
    const zero = profileDeclaredZeroLine(profile)
    const line1 = grossReceiptsLine1(profile)(forms)
    const line2 = zero('Schedule C line 2 (returns and allowances)')
    // 3. "Subtract line 2 from line 1."
    const line3 = differenceLine('Schedule C line 3 (net receipts)')(line1)(line2)
    const line4 = zero('Schedule C line 4 (cost of goods sold, from Part III line 42)')
    // 5. "Gross profit. Subtract line 4 from line 3."
    const line5 = differenceLine('Schedule C line 5 (gross profit)')(line3)(line4)
    const line6 = zero('Schedule C line 6 (other income, including the federal and state gasoline or fuel tax credit or refund)')
    // 7. "Gross income. Add lines 5 and 6."
    const line7 = totalLine('Schedule C line 7 (gross income)')([line5, line6])
    return { line1, line2, line3, line4, line5, line6, line7 }
}

// ── Part V: Other Expenses (line 48) ─────────────────────────────────────────

/**
 * **Part V, line 48**: *"Total other expenses. Enter here and on line 27a."*
 *
 * Part V is the one part of this form that is entirely computable, and it is
 * computable because it has no rule at all: it is a list of business expenses
 * not included on lines 8-26 or line 30, totalled. Every `otherExpenses` entry
 * IS a Part V line, and this total IS printed line 27a — which the Part II
 * record then restates under its own printed number, mirroring
 * `fjs/schedule/b`'s `line4 = { ...line2, rule: 'Schedule B line 4' }`
 * copy-line idiom.
 * @type {(profile: Stored<ReturnProfile>) => (entries: readonly StoredEntry[]) => ReportLine}
 */
export const scheduleCPartV = profile => entries => {
    const rule = 'Schedule C line 48 (total other expenses, Part V -> line 27a)'
    const sources = entries
        .filter(entry => entry.value.category === 'otherExpenses')
        .map(entry => ({
            documentHash: entry.documentHash,
            boxPath: 'entries[category=otherExpenses]',
            value: entry.value.amount,
        }))
    const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
    return documentLine(profile)(rule)(value)(sources)
}

// ── Part III and Part IV: the two parts that exist here only to refuse ───────

/**
 * The refusal for ONE refused category, if any entry carries it. The shared
 * body behind {@link scheduleCPartIII}, {@link scheduleCPartIV} and the
 * per-line refusals inside Part II — one rule, one place.
 *
 * The message names the printed line, the printed label, the entry that
 * triggered it and the remedy. All four: a refusal naming only the line tells
 * a reader nothing to do, and one naming only the remedy leaves them hunting
 * for which of their entries caused it.
 * @type {(entries: readonly StoredEntry[]) => (category: RefusedExpenseCategory) => ScheduleCRefusal | { readonly kind: 'ok' }}
 */
const refusalForCategory = entries => category => {
    const offending = entries.find(entry => entry.value.category === category)
    if (offending === undefined) {
        return { kind: 'ok' }
    }
    const row = refusedExpenseCategories.find(r => r.category === category)
    assert(row !== undefined, ['every refused category has a row', category])
    return {
        kind: 'error',
        message: `Schedule C line ${expenseCategoryLine[category]} (${row.label}): the business `
            + `expenses record asserts ${offending.value.amount} for `
            + `'${offending.value.description}' in category '${category}', which this engine `
            + `cannot compute — it ${row.remedy}. Refusing rather than dropping the expense `
            + `and overstating the profit`,
    }
}

/**
 * **Part III, Cost of Goods Sold (lines 33-42).** A named function for the
 * printed part, returning either the refusal or the documented zero that
 * reaches Part I line 4.
 *
 * The refusal fires on an ASSERTED `costOfGoodsSold` — the printed part has no
 * other trigger this engine can see, because inventory is not a payment and
 * appears on no information return. A proprietor with no inventory asserts
 * none and computes normally, which is what keeps this from being a blanket
 * refusal of every Schedule C.
 * @type {(entries: readonly StoredEntry[]) => ScheduleCRefusal | { readonly kind: 'ok' }}
 */
export const scheduleCPartIII = entries => refusalForCategory(entries)('costOfGoodsSold')

/**
 * **Part IV, Information on Your Vehicle (lines 43-47).** A named function for
 * the printed part, and it is the SAME rule as line 9's — deliberately, and
 * because the printed form says so: *"Complete this part only if you are
 * claiming car or truck expenses on line 9."*
 *
 * So Part IV has exactly one trigger, an asserted `carAndTruck` expense, and
 * exactly one answer for it. Writing it as its own function rather than
 * folding it into line 9 is what makes the printed part addressed rather than
 * skipped — and writing it as a call to the same helper is what stops the two
 * from being one rule in two places.
 * @type {(entries: readonly StoredEntry[]) => ScheduleCRefusal | { readonly kind: 'ok' }}
 */
export const scheduleCPartIV = entries => refusalForCategory(entries)('carAndTruck')

// ── Part II: Expenses (lines 8-32) ───────────────────────────────────────────

/**
 * Part II's printed fields. Lines 8 through 27b are the expense lines, 28 is
 * their total, 29 the tentative profit, 30 the home-office deduction and 31
 * the net profit or loss.
 *
 * Line 32 has no field: it is the at-risk determination, reached only on a
 * loss, and a loss refuses. See {@link atRiskDeterminationLine32}.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line8: ReportLine, readonly line9: ReportLine, readonly line10: ReportLine,
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: ReportLine, readonly line15: ReportLine, readonly line16a: ReportLine,
 *   readonly line16b: ReportLine, readonly line17: ReportLine, readonly line18: ReportLine,
 *   readonly line19: ReportLine, readonly line20a: ReportLine, readonly line20b: ReportLine,
 *   readonly line21: ReportLine, readonly line22: ReportLine, readonly line23: ReportLine,
 *   readonly line24a: ReportLine, readonly line24b: ReportLine, readonly line25: ReportLine,
 *   readonly line26: ReportLine, readonly line27a: ReportLine, readonly line27b: ReportLine,
 *   readonly line28: ReportLine, readonly line29: ReportLine, readonly line30: ReportLine,
 *   readonly line31: ReportLine,
 *   readonly line48: ReportLine,
 * }} ScheduleCPartII
 */

/** @typedef {ScheduleCPartII | ScheduleCRefusal} ScheduleCPartIIOutcome */

/**
 * **Line 32, the at-risk determination.** *"If you have a loss, check the box
 * that describes your investment in this activity ... 32a All investment is at
 * risk. 32b Some investment is not at risk ... If you checked 32b, you must
 * attach Form 6198. Your loss may be limited."*
 *
 * This engine cannot check either box, so this function always refuses — and
 * it is reached exactly when the printed form says to reach it, which is why
 * it is a real named function for a real printed line rather than a
 * placeholder. See this module's own docstring, "The net-loss decision", for
 * the full argument and for the two further limitations (§469 and §461(l))
 * that stand behind §465.
 * @type {(lossCents: bigint) => ScheduleCRefusal}
 */
export const atRiskDeterminationLine32 = lossCents => ({
    kind: 'error',
    message: `Schedule C line 31 is a LOSS of ${-lossCents} cents, and the printed form's own `
        + `instruction is "if a loss, you must go to line 32" — the at-risk determination, `
        + `which this engine cannot make. §465 basis in the activity is a multi-year history no `
        + `document here holds; checking box 32b requires Form 6198 and the loss "may be `
        + `limited". Two further limitations stand behind it: §469 makes a loss passive, and `
        + `deductible only on Form 8582, for a proprietor who does not materially participate, `
        + `and §461(l) disallows an excess business loss on Form 461 and carries it forward. So `
        + `the arithmetic loss is an UPPER BOUND on the deductible loss, never the deductible `
        + `loss itself, and letting it reach Schedule 1 line 3 would understate the tax while `
        + `moving adjusted gross income and every figure that depends on it. A PROFIT computes; `
        + `a loss refuses (Schedule SE and the at-risk rules, no phase yet)`,
})

/**
 * The exact cents sum of every entry carrying ONE computed category, with one
 * {@link Source} per entry — the Schedule C analog of `fjs/schedule/a`'s
 * `sumEntriesByLineTag`. Each emitted `boxPath` names the filter,
 * `entries[category=<category>]`, since this dialect has no fixed box layout.
 * @type {(profile: Stored<ReturnProfile>) => (entries: readonly StoredEntry[]) => (category: ComputedExpenseCategory) => ReportLine}
 */
const expenseLine = profile => entries => category => {
    const printedLine = expenseCategoryLine[category]
    const row = computedExpenseCategories.find(c => c.category === category)
    assert(row !== undefined, ['every computed category has a row', category])
    const sources = entries
        .filter(entry => entry.value.category === category)
        .map(entry => ({
            documentHash: entry.documentHash,
            boxPath: `entries[category=${category}]`,
            value: entry.value.amount,
        }))
    const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
    return documentLine(profile)(`Schedule C line ${printedLine} (${row.label})`)(value)(sources)
}

/**
 * Schedule C Part II — Expenses, lines 8 through 31, plus Part V's line 48
 * which feeds line 27a.
 *
 * **Every refused category is checked BEFORE any line is built**, so a return
 * carrying one never produces a partial Schedule C whose totals are short by
 * the refused amount. The five that sit inside the line-28 block (9, 12, 13,
 * 19, 24b) are checked here; line 30's and line 4's are checked by
 * {@link scheduleC}, beside Part III's and Part IV's, because those two are
 * not summands of line 28.
 *
 * The five refused lines are then documented zeros — reachable only when no
 * entry asserted them, which is the case the zero is honest for.
 * `line13Depreciation` is passed IN rather than computed here: it is Form 4562
 * line 22, and {@link scheduleC} is the layer that reads the register and owns
 * the refusal when Form 4562 cannot be completed. A business with no register
 * gets the documented zero this line has always been.
 * @type {(profile: Stored<ReturnProfile>) => (entries: readonly StoredEntry[]) => (line13Depreciation: ReportLine) => (line7GrossIncome: ReportLine) => ScheduleCPartIIOutcome}
 */
export const scheduleCPartII = profile => entries => line13Depreciation => line7GrossIncome => {
    const zero = profileDeclaredZeroLine(profile)
    const byCategory = expenseLine(profile)(entries)
    // The five refused lines INSIDE the line-28 block, in printed order, each
    // refused before anything is summed.
    /** @type {readonly RefusedExpenseCategory[]} */
    const refusedWithinLine28 = [
        'carAndTruck', 'depletion', 'depreciationAndSection179',
        'pensionAndProfitSharingPlans', 'deductibleMeals',
    ]
    for (const category of refusedWithinLine28) {
        const outcome = refusalForCategory(entries)(category)
        if (outcome.kind === 'error') {
            return outcome
        }
    }
    const line8 = byCategory('advertising')
    const line9 = zero('Schedule C line 9 (car and truck expenses)')
    const line10 = byCategory('commissionsAndFees')
    const line11 = byCategory('contractLabor')
    const line12 = zero('Schedule C line 12 (depletion)')
    // 13. "Depreciation and section 179 expense deduction (not included in
    //     Part III)." Form 4562 line 22, computed by {@link scheduleC} from a
    //     vnd.fjs.asset_register document -- or a documented zero when the
    //     business stores no register.
    const line13 = line13Depreciation
    const line14 = byCategory('employeeBenefitPrograms')
    const line15 = byCategory('insuranceOtherThanHealth')
    const line16a = byCategory('mortgageInterest')
    const line16b = byCategory('otherInterest')
    const line17 = byCategory('legalAndProfessionalServices')
    const line18 = byCategory('officeExpense')
    const line19 = zero('Schedule C line 19 (pension and profit-sharing plans)')
    const line20a = byCategory('rentOrLeaseVehiclesMachineryEquipment')
    const line20b = byCategory('rentOrLeaseOtherBusinessProperty')
    const line21 = byCategory('repairsAndMaintenance')
    const line22 = byCategory('supplies')
    const line23 = byCategory('taxesAndLicenses')
    const line24a = byCategory('travel')
    const line24b = zero('Schedule C line 24b (deductible meals)')
    const line25 = byCategory('utilities')
    const line26 = byCategory('wages')
    // Part V's own total, restated under its printed Part II number — the same
    // copy-line idiom `fjs/schedule/b`'s line 4 uses. The two must never be
    // computed twice: `partVTotalReachesLineTwentySevenAUnchanged` pins it.
    const line48 = scheduleCPartV(profile)(entries)
    const line27a = { ...line48, rule: 'Schedule C line 27a (other expenses, from Part V line 48)' }
    // 27b. "Reserved for future use" — the form's own inert line, modeled for
    //      line-number completeness and never a summand, exactly as
    //      `fjs/schedule/1` models its own reserved line 22.
    const line27b = zero('Schedule C line 27b (reserved for future use)')
    // 28. "Total expenses before expenses for business use of home. Add lines
    //     8 through 27a." Twenty-three summands, written out in printed order:
    //     line 27b is NOT one, because the printed addition stops at 27a.
    //
    //     **Five of the twenty-three are unobservable summands, and that is a
    //     property of this code rather than a gap in its proofs.** Lines 9,
    //     12, 13, 19 and 24b are `zero(...)` here and can never be anything
    //     else — every entry that could give them a value refuses above — so
    //     deleting any one of them from this addition cannot change the total
    //     at ANY input. Verified by mutation: dropping `line24b` left the
    //     whole suite green, and dropping `line24a` (which CAN carry a value)
    //     reddened three leaves. AGENTS.md's "equivalent mutant" case, and it
    //     is recorded here rather than treated as missing coverage: the five
    //     stay in the addition because the printed form adds them, and the day
    //     one of them starts computing is the day the mutation begins to bite.
    const line28 = totalLine('Schedule C line 28 (total expenses before business use of home)')([
        line8, line9, line10, line11, line12, line13, line14, line15, line16a, line16b,
        line17, line18, line19, line20a, line20b, line21, line22, line23, line24a, line24b,
        line25, line26, line27a,
    ])
    // 29. "Tentative profit or (loss). Subtract line 28 from line 7."
    const line29 = differenceLine('Schedule C line 29 (tentative profit or loss)')(line7GrossIncome)(line28)
    const line30 = zero('Schedule C line 30 (expenses for business use of your home)')
    // 31. "Net profit or (loss). Subtract line 30 from line 29."
    const line31 = differenceLine('Schedule C line 31 (net profit or loss -> Schedule 1 line 3)')(line29)(line30)
    return {
        kind: 'ok',
        line8, line9, line10, line11, line12, line13, line14, line15, line16a, line16b,
        line17, line18, line19, line20a, line20b, line21, line22, line23, line24a, line24b,
        line25, line26, line27a, line27b, line28, line29, line30, line31, line48,
    }
}

// ── The whole schedule ───────────────────────────────────────────────────────

/**
 * A computed Schedule C: every Part I and Part II field, plus Part V's line
 * 48.
 *
 * `filed` distinguishes a return with a business from one without. A taxpayer
 * with no `vnd.fjs.1099nec` and no `vnd.fjs.business_expenses` gets `filed:
 * false` and a schedule of documented zeros — not a refusal, and not an
 * absent schedule, because `fjs/schedule/1` still needs a `ReportLine` with
 * provenance for its own line 3 (PROV-01).
 *
 * **It is not derivable from the lines**, which is why it is a field rather
 * than a computation a caller could do: a business that broke exactly even
 * and a taxpayer with no business at all both produce a Schedule C of zeros,
 * and only the sources tell them apart. A caller reading `.value` — which is
 * what a report does — cannot.
 * `form4562` is the completed Form 4562 when this business stored a
 * `vnd.fjs.asset_register`, and `undefined` when it did not — which is a
 * different state from "a Form 4562 of zeros", exactly as `filed`
 * distinguishes a break-even business from no business. `fjs/form1040/core`
 * reads its `alternativeMinimumTaxAdjustmentCents` into Form 6251 line 2l, and
 * that is the ONLY route by which an asset register reaches the alternative
 * minimum tax: computing the adjustment a second time somewhere else would let
 * the two disagree.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly filed: boolean,
 *   readonly partI: ScheduleCPartI,
 *   readonly partII: ScheduleCPartII,
 *   readonly form4562: Form4562Lines | undefined,
 * }} ScheduleC
 */

/** @typedef {ScheduleC | ScheduleCRefusal} ScheduleCOutcome */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly nonemployeeCompensationForms: readonly Stored<OneZeroNineNineNec>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly w2Forms: readonly Stored<W2>[],
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 * }} ScheduleCInput
 */

/**
 * One business as a refusal can name it: the printed line A description,
 * plus the printed line C trading name when the record carries one.
 *
 * **Line C is what makes a two-business refusal readable in the case that
 * actually happens.** A taxpayer running two consultancies may describe both
 * as `'consulting'` on line A, and a message quoting that string twice would
 * name neither. Line C is optional on the printed form ("if no separate
 * business name, leave blank"), so it is appended only when present rather
 * than rendered as an empty parenthesis.
 * @type {(business: BusinessExpenses) => string}
 */
const businessLabel = business => business.businessName === undefined
    ? `'${business.principalBusiness}'`
    : `'${business.principalBusiness}' (${business.businessName})`


/**
 * The whole of Schedule C.
 *
 * The order of the checks below is the order they must run in, and each is
 * explained where it stands:
 *
 * 1. **A statutory-employee W-2**, before anything else, because it refuses
 *    whether or not the taxpayer has a business record at all — see this
 *    module's docstring.
 * 2. **A Form 1099-NEC with box 2 checked**, a direct-sales reseller, for the
 *    same reason: it refuses with or without a business record.
 * 3. **A second business record.** Schedule C is per business.
 * 4. **The no-business case**, which is an OK of documented zeros rather than
 *    a refusal.
 * 5. **Forms 1099-NEC with no business record**, which cannot produce a
 *    Schedule C: printed line A is required and the gross-receipts assertion
 *    is missing.
 * 6. **A business record without the gross-receipts assertion.**
 * 7. **An unrecognized category**, then **Part III**, **Part IV** and the two
 *    refused lines outside the line-28 block. All before arithmetic.
 * 8. The parts, then the **net-loss** refusal, then the **self-employment
 *    tax** refusal.
 * **This function takes no `TaxParamSet` as of Phase 28, and the removal is a
 * finding rather than a tidy-up.** Phase 27 threaded one in for exactly one
 * figure — §1402(b)(2)'s $400, compared against net profit because Schedule SE
 * did not exist. Phase 28 moved that comparison to printed Schedule SE line
 * 4c, where the page puts it and where it is applied to net EARNINGS, and
 * Schedule C was left with no tax-year parameter at all. It has none because
 * the printed form has none: not one figure on Schedule C is indexed, or
 * statutory, or a rate. A parameter set kept here "for symmetry" would be an
 * argument no line reads, which is the same YAGNI position `fjs/tax/params`
 * takes about storing a rate before the form that multiplies by it exists.
 * @type {(input: ScheduleCInput) => ScheduleCOutcome}
 */
export const scheduleC = input => {
    const {
        profile, nonemployeeCompensationForms, businessExpenseForms, w2Forms, rentalProperties,
    } = input
    // **A register whose account number names a stored rental property is
    // Schedule E Part I's, not this schedule's**, and it is removed here before
    // any rule below counts registers. Form 4562 is filed per business or
    // activity (i4562 p1), a rental property is an activity, and printed
    // Schedule E line 18 is where its line 22 goes. Filtering rather than
    // refusing is what lets a filer carry a sole proprietorship and a rental
    // on one return; the refusal below still fires for a register that names
    // NEITHER.
    const assetRegisters = input.assetRegisters.filter(register =>
        !rentalProperties.some(
            property => property.value.accountNumber === register.value.accountNumber))

    // 1. A statutory employee's box 1 wages belong on THIS form's line 1, not
    //    on 1040 line 1a, and this engine puts them on 1040 line 1a. Refused
    //    unconditionally — including for a taxpayer with no business record,
    //    who is precisely the case that would otherwise stay silently
    //    overstated by the whole of their Part II.
    const statutory = w2Forms.find(form => form.value.box13StatutoryEmployee === true)
    if (statutory !== undefined) {
        return {
            kind: 'error',
            message: 'Schedule C line 1: a stored Form W-2 has box 13 "Statutory employee" '
                + 'checked. Those wages belong on Schedule C line 1, not on 1040 line 1a, so '
                + 'that the proprietor’s Part II expenses can be deducted against them — '
                + 'and this engine reads every W-2 box 1 into 1040 line 1a, where no expense can '
                + 'reach it. Moving the amount requires it to LEAVE line 1a as well as arrive '
                + 'here, which nothing models; refusing rather than overstating a statutory '
                + 'employee’s income by the whole of their business expenses (no phase yet)',
        }
    }

    // 2. Form 1099-NEC box 2: "Payer made direct sales totaling $5,000 or
    //    more of consumer products to recipient for resale." Two consequences
    //    follow from that one checkbox, and this engine can compute neither.
    //    The goods are INVENTORY, so Part III applies and line 4 is not zero;
    //    and the resale proceeds are cash sales to consumers, which appear on
    //    no information return at all, so line 1 read from Forms 1099-NEC is
    //    short by the whole of the business's actual receipts. Checked BEFORE
    //    the gross-receipts assertion below, because a taxpayer could
    //    truthfully assert that their Forms 1099-NEC are their whole
    //    1099-reported income and still be a reseller.
    const directSales = nonemployeeCompensationForms.find(
        form => form.value.box2DirectSalesOfFiveThousandOrMore === true)
    if (directSales !== undefined) {
        return {
            kind: 'error',
            message: 'Schedule C: a stored Form 1099-NEC has box 2 checked — the payer made '
                + 'direct sales of $5,000 or more of consumer products to this recipient FOR '
                + 'RESALE. Two things follow that this engine cannot compute. The goods are '
                + 'inventory, so Part III (cost of goods sold) applies and line 4 is not zero; '
                + 'and the resale proceeds are cash sales to consumers, reported on no '
                + 'information return, so line 1 read from Forms 1099-NEC box 1 is short by the '
                + 'whole of what the business actually took in. Refusing rather than reporting a '
                + 'reseller’s gross receipts as their payer’s wholesale purchases (no phase yet)',
        }
    }

    // 3. Schedule C is filed PER BUSINESS, and this engine supports one.
    const [firstBusiness, secondBusiness] = businessExpenseForms
    if (firstBusiness !== undefined && secondBusiness !== undefined) {
        return {
            kind: 'error',
            message: `Schedule C: this return carries ${businessExpenseForms.length} business `
                + `expenses records, and Schedule C is filed PER BUSINESS — `
                + `${businessLabel(firstBusiness.value)} and `
                + `${businessLabel(secondBusiness.value)} are two Schedule Cs, with two `
                + `line 31s and two at-risk determinations. This engine computes one. Merging `
                + `them is not an approximation: it would net one business’s loss against `
                + `the other’s profit, which is the arithmetic §465 exists to stop `
                + `(no phase yet)`,
        }
    }

    // 3b. Form 4562 is filed PER BUSINESS OR ACTIVITY too (i4562 p1: "File a
    //     separate Form 4562 for each business or activity on your return for
    //     which Form 4562 is required"), so a second register is a second
    //     Form 4562, and this engine computes one.
    const [firstRegister, secondRegister] = assetRegisters
    if (firstRegister !== undefined && secondRegister !== undefined) {
        return {
            kind: 'error',
            message: `Schedule C: this return carries ${assetRegisters.length} `
                + `vnd.fjs.asset_register documents — '${firstRegister.value.businessOrActivity}' `
                + `and '${secondRegister.value.businessOrActivity}'. A separate Form 4562 is `
                + `filed for each business or activity, and the mid-quarter convention is decided `
                + `by an aggregate over ONE Form 4562's own additions, so merging two registers `
                + `would pick a convention neither business is on. This engine computes one `
                + `(no phase yet)`,
        }
    }
    // 3c. A register that NOTHING on this return claims. Refused rather than
    //     ignored: dropping it silently would compute a Schedule C that is
    //     right and lose the depreciation the register exists to supply.
    //
    //     A register whose account number names a stored
    //     `vnd.fjs.rental_property` never reaches here — it was filtered out at
    //     the top of this function, because Schedule E Part I claims it. Until
    //     that part existed this refusal fired for EVERY rental register, and
    //     its message said so; the correction is the wiring, not the wording.
    if (firstRegister !== undefined && firstBusiness === undefined) {
        return {
            kind: 'error',
            message: `Schedule C: this return carries a vnd.fjs.asset_register for `
                + `'${firstRegister.value.businessOrActivity}' with accountNumber `
                + `'${firstRegister.value.accountNumber}', and NOTHING on this return claims it — `
                + `no vnd.fjs.business_expenses record and no vnd.fjs.rental_property carries that `
                + `account number. Form 4562 line 22 has to reach a printed line, and this engine `
                + `wires it to exactly two: Schedule C line 13, from a business record, and `
                + `Schedule E line 18, from a rental property. Store whichever of the two this `
                + `activity is, with a MATCHING accountNumber, or remove the register rather than `
                + `have its depreciation silently dropped`,
        }
    }

    // 4. No business at all. Not a refusal — a schedule of documented zeros,
    //    so `fjs/schedule/1`'s line 3 still carries provenance (PROV-01) and a
    //    return with no self-employment computes exactly what it computed
    //    before this phase existed.
    if (firstBusiness === undefined && nonemployeeCompensationForms.length === 0) {
        const partI = scheduleCPartI(profile)([])
        const partII = scheduleCPartII(profile)([])(
            profileDeclaredZeroLine(profile)(
                'Schedule C line 13 (depreciation and section 179 expense deduction)'))(
            partI.line7)
        assert(partII.kind === 'ok', ['an empty Schedule C cannot refuse', partII])
        return { kind: 'ok', filed: false, partI, partII, form4562: undefined }
    }

    // 5. Receipts with no business record. Printed line A is required, and
    //    without the record there is no gross-receipts assertion either.
    if (firstBusiness === undefined) {
        return {
            kind: 'error',
            message: 'Schedule C: this return carries a Form 1099-NEC, which is nonemployee '
                + 'compensation and therefore self-employment income, but no '
                + 'vnd.fjs.business_expenses record. Even a Schedule C with no expenses at all '
                + 'needs printed line A (the principal business or profession) and the '
                + 'taxpayer’s own assertion that these Forms 1099-NEC are the whole of the '
                + 'gross receipts — §6041A requires one only at $600 and only from a payer '
                + 'in a trade or business, so cash and small-client receipts appear on no form. '
                + 'Store a vnd.fjs.business_expenses record for this business',
        }
    }

    // 6. The gross-receipts assertion. `fjs/document/business_expenses`' own
    //    header carries the whole argument for why its absence is a refusal
    //    rather than an assumption.
    if (firstBusiness.value.grossReceiptsFullyReportedOnForms1099Nec !== true) {
        return {
            kind: 'error',
            message: `Schedule C line 1 (gross receipts or sales) for `
                + `'${firstBusiness.value.principalBusiness}': this engine reads gross receipts `
                + `from Form 1099-NEC box 1 alone, and §6041A obliges a payer to file one only `
                + `for $600 or more and only if the payer is itself in a trade or business — `
                + `so cash receipts, payments from private individuals and every client under `
                + `$600 appear on no form this engine holds. Set `
                + `grossReceiptsFullyReportedOnForms1099Nec on the business expenses record if `
                + `that is true of your own books; refusing rather than understating gross `
                + `receipts, and the tax, by an amount nothing here could notice`,
        }
    }

    /** @type {readonly StoredEntry[]} */
    const entries = businessExpenseForms.flatMap(form =>
        form.value.entries.map(entry => ({ documentHash: form.documentHash, value: entry })))

    // 7a. An unrecognized category. `vnd.fjs.business_expenses` keeps
    //     `category` a free string on purpose, so this is the layer that owns
    //     the vocabulary — and it refuses rather than dropping an amount it
    //     does not understand, exactly as `fjs/schedule/a` does with its own
    //     itemized tags.
    const unrecognized = entries.find(entry =>
        !computedCategoryNames.includes(entry.value.category)
        && !refusedExpenseCategories.some(r => r.category === entry.value.category))
    if (unrecognized !== undefined) {
        return {
            kind: 'error',
            message: `Schedule C: the business expenses record carries an entry in category `
                + `'${unrecognized.value.category}' (${unrecognized.value.description}, `
                + `${unrecognized.value.amount}), which is not one of the `
                + `${printedExpenseLines.length} printed Schedule C expense lines this engine `
                + `recognizes. Refusing rather than dropping the expense from line 28 and `
                + `overstating the profit`,
        }
    }

    // 7b. Part III (line 4) and Part IV (line 9's substantiation), then line
    //     30 — the two refused categories that are NOT summands of line 28,
    //     which is why they are checked here rather than inside Part II.
    //     Part IV's own check duplicates line 9's, deliberately: the printed
    //     form conditions Part IV on line 9, and one call to one helper is
    //     what keeps that from becoming two rules.
    for (const outcome of [
        scheduleCPartIII(entries),
        scheduleCPartIV(entries),
        refusalForCategory(entries)('businessUseOfHome'),
    ]) {
        if (outcome.kind === 'error') {
            return outcome
        }
    }

    // 7c. The register names a business, and it must be THIS one. DOC-01's
    //     subject key is what binds them: `vnd.fjs.business_expenses` and
    //     `vnd.fjs.asset_register` both carry `accountNumber`, and a register
    //     whose account number names some other activity is a second Form
    //     4562 arriving by the back door.
    if (firstRegister !== undefined
        && firstRegister.value.accountNumber !== firstBusiness.value.accountNumber) {
        return {
            kind: 'error',
            message: `Schedule C: the vnd.fjs.asset_register for `
                + `'${firstRegister.value.businessOrActivity}' carries accountNumber `
                + `'${firstRegister.value.accountNumber}', and the business expenses record for `
                + `${businessLabel(firstBusiness.value)} carries `
                + `'${firstBusiness.value.accountNumber}'. A separate Form 4562 is filed for each `
                + `business or activity, so depreciating one activity's assets against another's `
                + `receipts would move a real deduction onto the wrong Schedule C. Make the two `
                + `account numbers agree, or store the register for the activity it belongs to`,
        }
    }
    // 7d. Form 4562. Its own refusals — Part I's §179 election, a current-year
    //     §168(k) allowance, Part V listed property, and the three
    //     certifications — are threaded out verbatim, so a register this
    //     engine cannot complete a Form 4562 for never produces a Schedule C
    //     whose line 28 is short by the depreciation.
    const line13Rule = 'Schedule C line 13 (depreciation and section 179 expense deduction)'
    /** @type {Form4562Lines | undefined} */
    let form4562 = undefined
    /** @type {ReportLine} */
    let line13 = profileDeclaredZeroLine(profile)(line13Rule)
    if (firstRegister !== undefined) {
        const outcome = formFortyFiveSixtyTwo({
            taxYear: firstRegister.value.taxYear,
            businessOrActivity: firstRegister.value.businessOrActivity,
            everyDepreciableAssetIsListed:
                firstRegister.value.everyDepreciableAssetIsListed === true,
            noDepreciablePropertyDisposedOfDuringTheYear:
                firstRegister.value.noDepreciablePropertyDisposedOfDuringTheYear === true,
            priorYearSection179CarryoverIsZero:
                firstRegister.value.priorYearSection179CarryoverIsZero === true,
            assets: depreciableAssets(firstRegister.value),
        })
        if (outcome.kind === 'error') {
            return outcome
        }
        form4562 = outcome
        line13 = documentLine(profile)(line13Rule)(outcome.line22)([{
            documentHash: firstRegister.documentHash,
            boxPath: 'assets -> Form 4562 line 22',
            value: centsToString(outcome.line22),
        }])
    }

    const partI = scheduleCPartI(profile)(nonemployeeCompensationForms)
    const partII = scheduleCPartII(profile)(entries)(line13)(partI.line7)
    if (partII.kind === 'error') {
        return partII
    }
    // 8. The net-loss decision. Zero computes; anything below it goes to the
    //    printed line 32 this engine cannot fill in.
    //
    //    **This is the LAST check now.** Phase 27 had a ninth, refusing any
    //    net profit at or above §1402(b)(2)'s $400 because line 31's other
    //    printed destination -- "and on Schedule SE, line 2" -- did not
    //    exist. Phase 28 built it (`fjs/schedule/se`, TAX-31), so the ceiling
    //    is gone and a real self-employed return computes end to end. The
    //    band that refusal over-refused, $400.00 to $433.12 of net profit,
    //    now computes a $0.00 self-employment tax, and `selfEmployment.the\
    //    BandPhaseTwentySevenOverRefusedNowComputes` is Phase 27's own leaf,
    //    re-pointed rather than deleted.
    if (partII.line31.value < 0n) {
        return atRiskDeterminationLine32(partII.line31.value)
    }
    return { kind: 'ok', filed: true, partI, partII, form4562 }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [],
}

/** @type {Stored<ReturnProfile>} */
const profile = { documentHash: 'profile-hash-c-0001', value: minimalProfileValue }

/** @type {(amount: string) => (hash: string) => Stored<OneZeroNineNineNec>} */
const necDoc = amount => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099nec',
        payerTin: '11-1111111', recipientTin: '222-22-2222', accountNumber: 'CLIENT-1',
        taxYear: 2025, formRevision: '2025',
        box1NonemployeeCompensation: amount,
    },
})

/** @type {(category: string) => (amount: string) => BusinessExpenses['entries'][number]} */
const entryOf = category => amount => ({
    category,
    datePaid: '2025-05-06',
    description: `a ${category} payment`,
    amount,
})

/** @type {(entries: readonly BusinessExpenses['entries'][number][]) => Stored<BusinessExpenses>} */
const businessDoc = entries => ({
    documentHash: 'sha256-business-a',
    value: {
        dialect: 'vnd.fjs.business_expenses',
        recipientTin: '222-22-2222',
        accountNumber: 'BUS-0001',
        taxYear: 2025,
        principalBusiness: 'software consulting',
        grossReceiptsFullyReportedOnForms1099Nec: true,
        entries,
    },
})

/**
 * A Form 1099-NEC with box 2 checked: the payer made $5,000 or more of direct
 * sales of consumer products to this recipient for resale.
 * @type {Stored<OneZeroNineNineNec>}
 */
const directSalesDoc = {
    documentHash: 'sha256-nec-a',
    value: {
        ...necDoc('6000.00')('sha256-nec-a').value,
        box2DirectSalesOfFiveThousandOrMore: /** @type {const} */ (true),
    },
}

/** A second business, which must refuse. @type {Stored<BusinessExpenses>} */
const secondBusinessDoc = {
    documentHash: 'sha256-business-b',
    value: {
        ...businessDoc([]).value,
        accountNumber: 'BUS-0002',
        principalBusiness: 'pottery',
    },
}


/**
 * An asset register for the SAME business `businessDoc` names, carrying one
 * $10,000.00 seven-year asset placed in service in June.
 *
 * `accountNumber` is a parameter because the account number is the ONLY thing
 * binding a register to a business, and the leaf that proves a mismatch
 * refuses has to be able to break exactly that.
 * @type {(accountNumber: string) => Stored<AssetRegister>}
 */
const registerDoc = accountNumber => ({
    documentHash: 'sha256-register-a',
    value: {
        dialect: 'vnd.fjs.asset_register',
        recipientTin: '222-22-2222',
        accountNumber,
        taxYear: 2025,
        businessOrActivity: 'software consulting',
        everyDepreciableAssetIsListed: /** @type {const} */ (true),
        noDepreciablePropertyDisposedOfDuringTheYear: /** @type {const} */ (true),
        priorYearSection179CarryoverIsZero: /** @type {const} */ (true),
        assets: [{
            description: 'workstation',
            datePlacedInService: '2025-06',
            costOrOtherBasis: '10000.00',
            businessUsePercentage: '100.00',
            classification: 'sevenYear',
            method: '200DB',
            convention: 'HY',
            section168kStatus: 'electedOut',
        }],
    },
})

/** A SECOND register, for a rental activity. @type {Stored<AssetRegister>} */
const secondRegisterDoc = {
    documentHash: 'sha256-register-b',
    value: {
        ...registerDoc('BUS-0002').value,
        businessOrActivity: 'residential rental',
    },
}

/** @type {W2} */
const bareW2Value = {
    dialect: 'vnd.fjs.w2',
    payerTin: '11-1111111', recipientTin: '222-22-2222', accountNumber: '',
    taxYear: 2025, formRevision: '2025',
}

/** @type {(input: Partial<ScheduleCInput>) => ScheduleCOutcome} */
const run = input => scheduleC({
    profile,
    nonemployeeCompensationForms: [],
    businessExpenseForms: [],
    w2Forms: [],
    assetRegisters: [],
    rentalProperties: [],
    ...input,
})

/**
 * Parts I and II for one business at realistic amounts — **through the
 * PRODUCT path as of Phase 28.**
 *
 * This helper used to call `scheduleCPartI` and `scheduleCPartII` directly,
 * and its docstring said why out loud: *"a Schedule C net profit of $400 or
 * more refuses through the product path until Phase 28 builds Schedule SE, so
 * a leaf about line 18's arithmetic cannot use `run(...)` on a realistic
 * $48,000 return."* Phase 28 built Schedule SE, the ceiling is gone, and the
 * reason this helper existed went with it.
 *
 * **It is re-pointed rather than deleted, and that is the stronger outcome.**
 * Every leaf built on it — the eighteen-category transposition sweep, line
 * 28's twenty-three summands, Part V's copy-line, the worked $48,000 case —
 * now runs through `scheduleC` itself instead of through two functions
 * composed by a test helper. Nothing about those leaves changed except that
 * they became product-path leaves, which is exactly what the split existed to
 * work around.
 * @type {(forms: readonly Stored<OneZeroNineNineNec>[]) => (entries: readonly BusinessExpenses['entries'][number][]) => { readonly partI: ScheduleCPartI, readonly partII: ScheduleCPartII }}
 */
const partsOf = forms => entries => {
    const outcome = run({
        nonemployeeCompensationForms: forms,
        businessExpenseForms: [businessDoc(entries)],
    })
    assert(outcome.kind === 'ok', ['expected a computed Schedule C', outcome])
    return { partI: outcome.partI, partII: outcome.partII }
}

/** Narrows an outcome to its OK arm, throwing (never casting).
 * @type {(outcome: ScheduleCOutcome) => ScheduleC}
 */
const ok = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Schedule C', outcome])
    return outcome
}

/** Narrows an outcome to its refusal arm, throwing (never casting).
 * @type {(outcome: ScheduleCOutcome) => ScheduleCRefusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/**
 * **The independent statement of the whole vocabulary**, hand-typed off the
 * printed 2025 Schedule C face: every category, the printed line it lands on,
 * and whether this engine computes it.
 *
 * Deliberately NOT derived from {@link expenseCategoryLine},
 * {@link computedExpenseCategories} or {@link refusedExpenseCategories} — all
 * three are the code under test, and AGENTS.md records four shipped defects
 * whose common shape is a proof whose expected side came from the thing it was
 * checking. `tsc` already guarantees the mapping is TOTAL on the categories
 * the two tables declare; what it cannot guarantee is that those tables name
 * the right categories, that each lands on the right printed line, or that the
 * computed/refused split is the one this phase decided. This list is the only
 * statement of those three facts that does not come from the code.
 * @type {readonly (readonly [string, string, boolean])[]}
 */
const printedCategoryLineTable = [
    ['costOfGoodsSold', '4', false],
    ['advertising', '8', true],
    ['carAndTruck', '9', false],
    ['commissionsAndFees', '10', true],
    ['contractLabor', '11', true],
    ['depletion', '12', false],
    ['depreciationAndSection179', '13', false],
    ['employeeBenefitPrograms', '14', true],
    ['insuranceOtherThanHealth', '15', true],
    ['mortgageInterest', '16a', true],
    ['otherInterest', '16b', true],
    ['legalAndProfessionalServices', '17', true],
    ['officeExpense', '18', true],
    ['pensionAndProfitSharingPlans', '19', false],
    ['rentOrLeaseVehiclesMachineryEquipment', '20a', true],
    ['rentOrLeaseOtherBusinessProperty', '20b', true],
    ['repairsAndMaintenance', '21', true],
    ['supplies', '22', true],
    ['taxesAndLicenses', '23', true],
    ['travel', '24a', true],
    ['deductibleMeals', '24b', false],
    ['utilities', '25', true],
    ['wages', '26', true],
    ['otherExpenses', '27a', true],
    ['businessUseOfHome', '30', false],
]

/** Hand-typed, off the printed form: twenty-five categories in all. */
const expectedCategoryCount = 25
/** Hand-typed: eighteen compute. */
const expectedComputedCategoryCount = 18
/** Hand-typed: seven refuse. `18 + 7 = 25`. */
const expectedRefusedCategoryCount = 7
/**
 * Hand-typed: the twenty-three printed lines line 28 says to add, 8 through
 * 27a. `25 - 2`: line 4 is Part I's and line 30 is subtracted at line 31.
 */
const expectedLine28SummandCount = 23

export const proof = {
    vocabulary: {
        // The hand-typed counts, and the three-way agreement between them.
        // Every loop below walks a table that IS the code under test, so
        // these are the counterweight that notices a table shrinking.
        theCountsAgree: () => {
            assertEq(computedExpenseCategories.length, expectedComputedCategoryCount)
            assertEq(refusedExpenseCategories.length, expectedRefusedCategoryCount)
            assertEq(printedExpenseLines.length, expectedCategoryCount)
            assertEq(printedCategoryLineTable.length, expectedCategoryCount)
            assertEq(
                expectedComputedCategoryCount + expectedRefusedCategoryCount,
                expectedCategoryCount,
                'the computed and refused counts must together cover every category',
            )
            assertEq(Object.keys(expenseCategoryLine).length, expectedCategoryCount)
        },
        // THE COMPARISON. The hand-typed printed table above, checked against
        // all three code tables, in both directions — so a category that lost
        // its row, gained the wrong printed line, or moved between the
        // computed and refused halves names itself.
        //
        // AGENTS.md: "a hand-typed list drifts unless something COMPARES it to
        // what it mirrors". This is that comparison, and it is the whole
        // reason `printedCategoryLineTable` exists as a fourth copy rather
        // than as a comment.
        theHandTypedPrintedTableAgreesWithTheCode: () => {
            for (const [category, printedLine, computes] of printedCategoryLineTable) {
                const inComputed = computedExpenseCategories.filter(c => c.category === category).length
                const inRefused = refusedExpenseCategories.filter(r => r.category === category).length
                assertEq(
                    inComputed + inRefused,
                    1,
                    ['every printed category must be declared exactly once', category, inComputed, inRefused],
                )
                assertEq(
                    inComputed === 1,
                    computes,
                    ['this category is on the wrong side of the computed/refused split', category],
                )
                const mapped = Object.entries(expenseCategoryLine)
                    .filter(([name]) => name === category)
                    .map(([, line]) => line)
                assertEq(mapped.length, 1, ['a category maps to no printed line, or to several', category])
                assertEq(mapped[0], printedLine, ['a category maps to the wrong printed line', category])
            }
            // …and in the other direction: nothing in the code is missing from
            // the hand-typed table. Without this half, a twenty-sixth category
            // could be added to the code and every loop above would still pass.
            for (const { category } of computedExpenseCategories) {
                assert(
                    printedCategoryLineTable.some(([name]) => name === category),
                    ['a computed category is not on the printed form', category])
            }
            for (const { category } of refusedExpenseCategories) {
                assert(
                    printedCategoryLineTable.some(([name]) => name === category),
                    ['a refused category is not on the printed form', category])
            }
        },
        // `tsc` guarantees {@link expenseCategoryLine} is TOTAL on the
        // category union and says nothing about the codomain, so two
        // categories mapping to one printed line would compile — and would
        // quietly merge two printed lines into one. This is the half of the
        // property the type system cannot express.
        theMappingIsABijectionOntoThePrintedLines: () => {
            const mapped = Object.values(expenseCategoryLine)
            assertEq(mapped.length, expectedCategoryCount)
            assertEq(new Set(mapped).size, expectedCategoryCount, 'two categories share a printed line')
            for (const line of printedExpenseLines) {
                assert(
                    mapped.includes(line),
                    ['a printed Schedule C expense line has no category at all', line])
            }
        },
        // Every refused category names a form, a fact or a section a reader
        // can act on. A remedy that only said "not supported" would satisfy
        // criterion 4's letter and none of its point.
        everyRefusedCategoryNamesALabelAndARemedy: () => {
            for (const row of refusedExpenseCategories) {
                assert(row.label.length > 0, ['a refused category has no printed label', row.category])
                assert(row.remedy.length > 0, ['a refused category has no remedy', row.category])
            }
        },
    },

    // ── THE REGRESSION CONTROL ───────────────────────────────────────────────
    //
    // A return with no business documents at all computes a schedule of
    // documented zeros — NOT a refusal, and not an absent schedule. This
    // matters more than any other leaf in this file: it is the property that
    // says Phase 27 moved nothing for every return that has no
    // self-employment, which is most of them.
    theReturnWithNoBusinessComputesZerosCitingTheProfile: () => {
        const result = ok(run({}))
        assertEq(result.filed, false)
        assertEq(result.partI.line7.value, 0n, 'gross income $0.00')
        assertEq(result.partII.line28.value, 0n, 'total expenses $0.00')
        assertEq(result.partII.line31.value, 0n, 'net profit $0.00')
        for (const line of [result.partI.line1, result.partII.line28, result.partII.line31]) {
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profile.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },

    partI: {
        // Two clients, and EACH is cited. A single-document proof could not
        // tell a sum from a "read the first one" bug.
        //
        // $48,000.00 + $12,500.00 = $60,500.00, hand-added.
        lineOneSumsEveryFormCitingEach: () => {
            const result = partsOf([
                necDoc('48000.00')('sha256-nec-a'),
                necDoc('12500.00')('sha256-nec-b'),
            ])([])
            assertEq(result.partI.line1.value, 6050000n, '$48,000.00 + $12,500.00 = $60,500.00')
            assertEq(result.partI.line1.sources.length, 2)
            const [first, second] = result.partI.line1.sources
            assert(second !== undefined, ['two forms must yield two sources', result.partI.line1.sources])
            assertEq(first.documentHash, 'sha256-nec-a')
            assertEq(second.documentHash, 'sha256-nec-b')
            assertEq(first.boxPath, 'box1NonemployeeCompensation')
            // The hard zero is REPLACED, not supplemented.
            assert(
                first.boxPath !== 'declaredKinds',
                ['line 1 must cite the form, not the profile', first])
        },
        // Lines 3, 5 and 7 are the printed arithmetic, and with lines 2, 4 and
        // 6 all documented zeros every one of them equals line 1. Asserted
        // individually so a subtraction written the wrong way round — line 2
        // minus line 1 — reddens on line 3 rather than surviving as a sign
        // error nothing looks at.
        theIncomeArithmeticCarriesLineOneThroughToLineSeven: () => {
            const result = partsOf([necDoc('48000.00')('sha256-nec-a')])([])
            assertEq(result.partI.line1.value, 4800000n)
            assertEq(result.partI.line2.value, 0n, 'returns and allowances: a documented zero')
            assertEq(result.partI.line3.value, 4800000n, 'line 1 - line 2')
            assertEq(result.partI.line4.value, 0n, 'cost of goods sold: a documented zero')
            assertEq(result.partI.line5.value, 4800000n, 'line 3 - line 4')
            assertEq(result.partI.line6.value, 0n, 'other income: a documented zero')
            assertEq(result.partI.line7.value, 4800000n, 'line 5 + line 6')
        },
        // A 1099-NEC with NO box 1 contributes nothing and is not counted as a
        // source. Absent is not zero-valued: it is not present at all (DOC-11).
        aFormWithoutBoxOneContributesNoSource: () => {
            const withholdingOnly = {
                documentHash: 'sha256-nec-c',
                value: {
                    ...necDoc('0.00')('sha256-nec-c').value,
                    box1NonemployeeCompensation: undefined,
                    box4FederalIncomeTaxWithheld: '1200.00',
                },
            }
            const result = partsOf([withholdingOnly])([])
            assertEq(result.partI.line1.value, 0n)
            assertEq(result.partI.line1.sources[0].boxPath, 'declaredKinds')
        },
    },

    partII: {
        // Every one of the eighteen computed categories, one at a time, each
        // landing on its OWN printed line and on no other. This is the leaf
        // that catches a transposition — `travel` summed onto line 24b, or
        // `supplies` onto line 22's neighbour — which no total could notice,
        // because a transposition preserves line 28.
        //
        // The amount is a distinct, non-round `$1,234.56` for every category,
        // and the assertion is about WHICH of the twenty-three printed lines
        // received it — never merely that line 28 moved, which a transposition
        // leaves untouched by construction.
        everyComputedCategoryLandsOnItsOwnPrintedLine: () => {
            const cents = 123456n
            for (const [category, printedLine, computes] of printedCategoryLineTable) {
                if (!computes) {
                    continue
                }
                const result = partsOf([necDoc('48000.00')('sha256-nec-a')])(
                    [entryOf(category)('1234.56')])
                const { partII } = result
                assertEq(partII.line28.value, cents, ['line 28 must carry this category', category])
                // Found by each line's own printed `rule` string rather than
                // by indexing a record with a computed key — which
                // `noUncheckedIndexedAccess` would make a `| undefined` and
                // AGENTS.md forbids casting away.
                const landed = [
                    partII.line8, partII.line9, partII.line10, partII.line11,
                    partII.line12, partII.line13, partII.line14, partII.line15,
                    partII.line16a, partII.line16b, partII.line17, partII.line18,
                    partII.line19, partII.line20a, partII.line20b, partII.line21,
                    partII.line22, partII.line23, partII.line24a, partII.line24b,
                    partII.line25, partII.line26, partII.line27a,
                ].filter(line => line.value === cents)
                assertEq(landed.length, 1, ['exactly one printed line must carry the amount', category])
                const only = landed[0]
                assert(only !== undefined, ['filtered to exactly one', category])
                assert(
                    only.rule.startsWith(`Schedule C line ${printedLine} `),
                    ['the amount landed on the wrong printed line', category, printedLine, only.rule])
            }
        },
        // Line 28's twenty-three summands, hand-typed as (printed line,
        // value) pairs and re-added here — so a summand silently dropped from
        // the total reddens. The count is hand-typed too: `totalLine` would
        // happily add twenty-two.
        lineTwentyEightIsExactlyTheTwentyThreePrintedSummands: () => {
            const result = partsOf([necDoc('48000.00')('sha256-nec-a')])([
                entryOf('advertising')('1250.00'),
                entryOf('officeExpense')('184.99'),
                entryOf('travel')('900.01'),
                entryOf('otherExpenses')('42.00'),
            ])
            const { partII } = result
            /** @type {readonly (readonly [string, ReportLine])[]} */
            const summands = [
                ['8', partII.line8], ['9', partII.line9], ['10', partII.line10],
                ['11', partII.line11], ['12', partII.line12], ['13', partII.line13],
                ['14', partII.line14], ['15', partII.line15], ['16a', partII.line16a],
                ['16b', partII.line16b], ['17', partII.line17], ['18', partII.line18],
                ['19', partII.line19], ['20a', partII.line20a], ['20b', partII.line20b],
                ['21', partII.line21], ['22', partII.line22], ['23', partII.line23],
                ['24a', partII.line24a], ['24b', partII.line24b], ['25', partII.line25],
                ['26', partII.line26], ['27a', partII.line27a],
            ]
            assertEq(summands.length, expectedLine28SummandCount)
            assertEq(
                summands.reduce((total, [, line]) => total + line.value, 0n),
                partII.line28.value,
                'line 28 must be exactly the sum of the twenty-three printed lines 8 through 27a',
            )
            // $1,250.00 + $184.99 + $900.01 + $42.00 = $2,377.00, hand-added.
            assertEq(partII.line28.value, 237700n, '$1,250.00 + $184.99 + $900.01 + $42.00')
            // Line 27b is NOT a summand. The printed addition stops at 27a,
            // and a reserved line quietly joining the total is exactly the
            // kind of thing a total-only assertion cannot see.
            assert(
                !summands.some(([printed]) => printed === '27b'),
                'the printed line 28 adds lines 8 through 27a, not 27b')
            assertEq(partII.line27b.value, 0n)
        },
        // Part V's total IS line 27a, restated rather than recomputed. Two
        // `otherExpenses` entries, so a "read the first one" bug cannot pass.
        //
        // $42.00 + $19.95 = $61.95, hand-added.
        partVTotalReachesLineTwentySevenAUnchanged: () => {
            const result = partsOf([necDoc('48000.00')('sha256-nec-a')])([
                entryOf('otherExpenses')('42.00'),
                entryOf('otherExpenses')('19.95'),
            ])
            assertEq(result.partII.line48.value, 6195n, '$42.00 + $19.95 = $61.95')
            assertEq(result.partII.line27a.value, result.partII.line48.value)
            assertEq(result.partII.line48.sources.length, 2)
            // The two lines differ in exactly one field, the printed rule.
            assert(
                result.partII.line48.rule.includes('line 48'),
                ['Part V\'s own line must name itself', result.partII.line48.rule])
            assert(
                result.partII.line27a.rule.includes('line 27a'),
                ['line 27a must name itself', result.partII.line27a.rule])
        },
        // THE WORKED CASE, hand-derived end to end.
        //
        //   line 1  gross receipts        1099-NEC box 1        $48,000.00
        //   line 7  gross income          = line 1              $48,000.00
        //   line 8  advertising                                  $1,250.00
        //   line 18 office expense                                 $184.99
        //   line 23 taxes and licenses                             $800.00
        //   line 24a travel                                        $900.01
        //   line 27a other expenses (Part V)                        $61.95
        //   line 28 total expenses  1250.00+184.99+800.00+900.01+61.95
        //                           = $3,196.95
        //   line 29 tentative profit  48,000.00 - 3,196.95 = $44,803.05
        //   line 30 business use of home                             $0.00
        //   line 31 net profit        44,803.05 - 0.00    = $44,803.05
        aWorkedProfitComputesEveryPrintedLine: () => {
            const result = partsOf([necDoc('48000.00')('sha256-nec-a')])([
                entryOf('advertising')('1250.00'),
                entryOf('officeExpense')('184.99'),
                entryOf('taxesAndLicenses')('800.00'),
                entryOf('travel')('900.01'),
                entryOf('otherExpenses')('61.95'),
            ])
            assertEq(result.partI.line7.value, 4800000n, 'gross income $48,000.00')
            assertEq(result.partII.line8.value, 125000n, '$1,250.00')
            assertEq(result.partII.line18.value, 18499n, '$184.99')
            assertEq(result.partII.line23.value, 80000n, '$800.00')
            assertEq(result.partII.line24a.value, 90001n, '$900.01')
            assertEq(result.partII.line27a.value, 6195n, '$61.95')
            assertEq(result.partII.line28.value, 319695n, '$3,196.95')
            assertEq(result.partII.line29.value, 4480305n, '$48,000.00 - $3,196.95 = $44,803.05')
            assertEq(result.partII.line30.value, 0n)
            assertEq(result.partII.line31.value, 4480305n, '$44,803.05 reaches Schedule 1 line 3')
        },
        // A BREAK-EVEN return computes, and it is the boundary of the net-loss
        // refusal: expenses exactly equal to gross income give line 31 = $0.00,
        // which is not a loss and must not refuse. One cent more is the leaf
        // below. Without this pair, a refusal written `<= 0n` would pass every
        // loss proof in this file.
        exactlyBreakEvenComputesRatherThanRefusing: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('1250.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('1250.00')])],
            }))
            assertEq(result.partII.line31.value, 0n, '$1,250.00 - $1,250.00 = $0.00')
            assertEq(result.filed, true)
        },
        // THE END-TO-END LEAF, and the one that keeps `partsOf` honest: a
        // whole Schedule C through the PRODUCT path, `scheduleC` itself,
        // producing a real non-zero line 31.
        //
        //   line 1  gross receipts   1099-NEC box 1            $500.00
        //   line 8  advertising                                $150.00
        //   line 28 total expenses                             $150.00
        //   line 31 net profit       500.00 - 150.00           $350.00
        //
        // $350.00 is below §1402(b)(2)'s $400, which is why this composition
        // survives the self-employment refusal — see
        // `selfEmployment.theFourHundredDollarBoundaryPair`.
        aSubFourHundredDollarProfitComputesEndToEnd: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('500.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('150.00')])],
            }))
            assertEq(result.filed, true)
            assertEq(result.partI.line1.value, 50000n, '$500.00')
            assertEq(result.partI.line7.value, 50000n, 'gross income $500.00')
            assertEq(result.partII.line8.value, 15000n, '$150.00')
            assertEq(result.partII.line28.value, 15000n, '$150.00')
            assertEq(result.partII.line29.value, 35000n, '$500.00 - $150.00 = $350.00')
            assertEq(result.partII.line31.value, 35000n, '$350.00 reaches Schedule 1 line 3')
        },
    },

    netLoss: {
        // THE PHASE'S SHARPEST DECISION, and its boundary is one cent from the
        // leaf above: $1,250.01 of expenses against $1,250.00 of receipts is a
        // one-cent loss, and it refuses.
        oneCentOfLossRefusesNamingLineThirtyTwoAndForm6198: () => {
            const result = refusal(run({
                nonemployeeCompensationForms: [necDoc('1250.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('1250.01')])],
            }))
            assert(result.message.includes('line 32'), ['must name the printed line', result.message])
            assert(result.message.includes('Form 6198'), ['must name the at-risk form', result.message])
            assert(result.message.includes('§465'), ['must name the at-risk section', result.message])
            // The two limitations BEHIND the at-risk rules, each asserted
            // separately: a refusal that named only Form 6198 would tell a
            // reader that solving the at-risk question is enough, and it is
            // not.
            assert(result.message.includes('Form 8582'), ['must name the passive-activity form', result.message])
            assert(result.message.includes('Form 461'), ['must name the excess-business-loss form', result.message])
            // …and it must say which DIRECTION the error would go, which is
            // the part a reader weighing whether to override it needs.
            assert(
                result.message.includes('understate the tax'),
                ['must say the loss would understate the tax', result.message])
        },
        // A substantial loss refuses too, and the refusal QUOTES the amount —
        // erasing it leaves a message that says a loss exists without saying
        // how large, which is the interpolation-erasure mutation AGENTS.md
        // says almost nobody runs.
        //
        // $10,000.00 receipts - $25,000.00 expenses = -$15,000.00 = -1500000 cents.
        aSubstantialLossRefusesQuotingTheAmount: () => {
            const result = refusal(run({
                nonemployeeCompensationForms: [necDoc('10000.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('25000.00')])],
            }))
            assert(
                result.message.includes('1500000'),
                ['the refusal must quote the size of the loss', result.message])
        },
        // {@link atRiskDeterminationLine32} is reachable directly, and it
        // always refuses — the printed line, implemented, returning the only
        // honest answer this engine has. Called with a profit-shaped argument
        // it STILL refuses, which is what makes it a line-32 function rather
        // than a sign test: the printed form only ever reaches line 32 on a
        // loss, and it is `scheduleC`'s job to decide that, not this one's.
        lineThirtyTwoAlwaysRefusesWhoeverCallsIt: () => {
            assertEq(atRiskDeterminationLine32(-1n).kind, 'error')
            assertEq(atRiskDeterminationLine32(-1500000n).kind, 'error')
        },
    },

    // ── PHASE 27's CEILING, LIFTED ───────────────────────────────────────────
    //
    // Every leaf in this group asserted a REFUSAL until Phase 28. Each is
    // re-pointed to the computation that replaced it rather than deleted,
    // because a deleted leaf leaves no record that the boundary ever moved —
    // and the boundary is the whole content of both phases.
    selfEmployment: {
        // THE BOUNDARY PAIR, one cent apart, and it now computes on BOTH
        // sides. $399.99 refused nothing before and still computes; $400.00
        // refused before and now computes too, with a self-employment tax of
        // $0.00 because §1402(a)(12)'s 92.35% puts its net EARNINGS at
        // $369.40 — below §1402(b)(2)'s floor.
        //
        // The tax itself is Schedule SE's, and this schedule does not carry
        // it; what this leaf says is that line 31 reaches Schedule 1 line 3
        // in full at both amounts, which is what Phase 27 could not do.
        theFourHundredDollarBoundaryPairNowComputesOnBothSides: () => {
            const below = ok(run({
                nonemployeeCompensationForms: [necDoc('399.99')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([])],
            }))
            assertEq(below.partII.line31.value, 39999n, 'one cent below §1402(b)(2)\'s $400.00')
            assertEq(below.filed, true)
            const at = ok(run({
                nonemployeeCompensationForms: [necDoc('400.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([])],
            }))
            assertEq(at.partII.line31.value, 40000n, 'exactly $400.00 of net profit now COMPUTES')
            assertEq(at.filed, true)
            // 92.35% of $400.00 is $369.40, hand-computed here rather than
            // read from Schedule SE, so this leaf states why the tax is zero
            // without depending on the module that computes it.
            assertEq(40000n * 9235n / 10000n, 36940n, 'net earnings are $369.40, below the $400 floor')
        },
        // A REALISTIC PROFIT computes end to end through the product path.
        // $48,000.00 of receipts less $3,000.00 of advertising is $45,000.00,
        // and this leaf asserted a REFUSAL quoting `4500000` until Phase 28.
        // It is the single clearest statement that a self-employed return can
        // now be filed at all.
        aRealisticProfitComputesRatherThanRefusing: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('48000.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('3000.00')])],
            }))
            assertEq(result.filed, true)
            assertEq(result.partI.line7.value, 4800000n, 'gross income $48,000.00')
            assertEq(result.partII.line28.value, 300000n, 'total expenses $3,000.00')
            assertEq(
                result.partII.line31.value, 4500000n,
                '$48,000.00 - $3,000.00 = $45,000.00 reaches Schedule 1 line 3')
        },
        // A LARGE profit computes too, so the ceiling is genuinely gone
        // rather than merely raised. $300,000.00 of receipts and no expenses
        // is well past every figure Phase 27 could reach.
        aProfitFarAboveTheOldCeilingComputes: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('300000.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([])],
            }))
            assertEq(result.partII.line31.value, 30000000n, '$300,000.00')
        },
        // **THE LEAF PHASE 27 WROTE FOR THIS EXACT MOMENT.** Its own comment
        // read: *"the day Phase 28 lands and this stops being true, this leaf
        // reddens and somebody has to decide deliberately — which is the
        // whole reason it is a leaf and not a comment."* It reddened, and
        // this is the deliberate decision.
        //
        // Phase 27 refused a net profit of $433.12 while recording that it
        // owed nothing: it compared §1402(b)(2)'s floor against net PROFIT
        // rather than against §1402(a)(12)'s net EARNINGS, because applying
        // the 92.35% factor would have been computing Schedule SE. The band
        // that over-refused — $400.00 to $433.12 of net profit — now
        // computes, and the arithmetic that made it an over-refusal is kept
        // verbatim as the arithmetic that now makes it a $0.00 tax.
        theBandPhaseTwentySevenOverRefusedNowComputes: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('433.12')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([])],
            }))
            assertEq(result.partII.line31.value, 43312n, '$433.12 reaches Schedule 1 line 3')
            assertEq(result.filed, true)
            // Phase 27's own hand-derived line, unchanged: 92.35% of $433.12
            // is under $400.00, so no self-employment tax is owed on it. What
            // changed is that this engine now says so by computing rather
            // than by refusing. `fjs/schedule/se`'s own
            // `theFourHundredDollarFloorIsAppliedToNetEARNINGS` is where the
            // half-up rounding makes the real boundary one cent higher, at
            // $433.13.
            assertEq(43312n * 9235n / 10000n, 39998n, '92.35% of $433.12 is under $400.00')
        },
        // …and one cent above it, $433.13, ALSO computes here — because this
        // schedule no longer has an opinion about self-employment tax at all.
        // The pair is what says the ceiling was removed rather than moved:
        // Schedule C stops at line 31 for every profit, and the $400 question
        // is now asked exactly once, on the form that prints it.
        theSchedulePassesEveryProfitOnRegardlessOfTheFloor: () => {
            for (const [receipts, cents] of [
                ['433.13', 43313n],
                ['433.12', 43312n],
                ['400.00', 40000n],
                ['399.99', 39999n],
            ]) {
                const result = ok(run({
                    nonemployeeCompensationForms: [necDoc(`${receipts}`)('sha256-nec-a')],
                    businessExpenseForms: [businessDoc([])],
                }))
                assertEq(result.partII.line31.value, cents, ['line 31 computes', receipts])
            }
        },
    },

    refusals: {
        // One generated leaf per refused category: an entry in it stops the
        // whole schedule, and the message names the printed line, the printed
        // label, the entry and the remedy. Four assertions, because a refusal
        // missing any one of them is a refusal a reader cannot act on.
        ...Object.fromEntries(refusedExpenseCategories.map(row => [
            `${row.category}IsRefusedByName`,
            () => {
                const result = refusal(run({
                    nonemployeeCompensationForms: [necDoc('48000.00')('sha256-nec-a')],
                    businessExpenseForms: [businessDoc([entryOf(row.category)('3000.00')])],
                }))
                assert(
                    result.message.includes(`line ${expenseCategoryLine[row.category]}`),
                    ['the refusal must name the printed line', row.category, result.message])
                assert(
                    result.message.includes(row.label),
                    ['the refusal must name the printed label', row.category, result.message])
                assert(
                    result.message.includes(row.category),
                    ['the refusal must name the category the entry carried', row.category, result.message])
                assert(
                    result.message.includes(row.remedy),
                    ['the refusal must carry the remedy, which is the only actionable half', row.category, result.message])
                assert(
                    result.message.includes('3000.00'),
                    ['the refusal must quote the amount it is refusing', row.category, result.message])
            },
        ])),
        // THE CONTROL for every leaf above: the SAME return with the SAME
        // amount in a COMPUTED category computes. A guard that refused every
        // business expense would pass all seven generated leaves.
        theSameAmountInAComputedCategoryComputes: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('3300.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([entryOf('advertising')('3000.00')])],
            }))
            assertEq(result.partII.line28.value, 300000n, '$3,000.00')
            assertEq(result.partII.line31.value, 30000n, '$3,300.00 - $3,000.00 = $300.00')
        },
        // An unrecognized category is refused, quoting the category, the
        // description and the amount. `vnd.fjs.business_expenses` accepts any
        // string, deliberately, so this is the only layer that can catch it —
        // and dropping the expense here would overstate the profit.
        anUnrecognizedCategoryIsRefusedQuotingIt: () => {
            const result = refusal(run({
                businessExpenseForms: [businessDoc([{
                    category: 'bribes',
                    datePaid: '2025-05-06',
                    description: 'an envelope',
                    amount: '5000.00',
                }])],
            }))
            assert(result.message.includes('bribes'), ['must quote the category', result.message])
            assert(result.message.includes('an envelope'), ['must name the entry', result.message])
            assert(result.message.includes('5000.00'), ['must quote the amount', result.message])
        },
        // Part III and Part IV are named functions for named printed parts,
        // and each is reachable on its own. Part IV's condition is the printed
        // form's own: "complete this part only if you are claiming car or
        // truck expenses on line 9."
        partIIIAndPartIVAreReachableAsTheirOwnPrintedParts: () => {
            const noEntries = /** @type {readonly StoredEntry[]} */ ([])
            assertEq(scheduleCPartIII(noEntries).kind, 'ok', 'no inventory asserted: Part III is silent')
            assertEq(scheduleCPartIV(noEntries).kind, 'ok', 'no vehicle asserted: Part IV is silent')
            /** @type {readonly StoredEntry[]} */
            const inventory = [{ documentHash: 'h', value: entryOf('costOfGoodsSold')('900.00') }]
            /** @type {readonly StoredEntry[]} */
            const vehicle = [{ documentHash: 'h', value: entryOf('carAndTruck')('900.00') }]
            const partIII = scheduleCPartIII(inventory)
            assert(partIII.kind === 'error', ['an asserted cost of goods sold must refuse', partIII])
            assert(
                partIII.message.includes('inventory'),
                ['Part III\'s refusal must name what it is missing', partIII.message])
            const partIV = scheduleCPartIV(vehicle)
            assert(partIV.kind === 'error', ['an asserted car expense must refuse', partIV])
            assert(
                partIV.message.includes('Part IV'),
                ['line 9\'s refusal must name Part IV, which the printed form conditions on it', partIV.message])
            // …and Part IV is silent on an inventory entry, Part III on a
            // vehicle one. Without this cross-check, both functions could be
            // reading the same category and every leaf above would pass.
            assertEq(scheduleCPartIII(vehicle).kind, 'ok')
            assertEq(scheduleCPartIV(inventory).kind, 'ok')
        },
    },

    assetRegister: {
        /**
         * Line 13 is a real figure now, and it is Publication 946's: Table
         * A-1's 7-year half-year year-1 rate of 14.29% on $10,000.00 is
         * **$1,429.00**. Gross receipts are $6,000.00 with no other expenses,
         * so line 28 is $1,429.00 and line 31 is **$4,571.00**. Every figure
         * hand-computed off the printed table.
         */
        lineThirteenIsFormFortyFiveSixtyTwoLineTwentyTwo: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [registerDoc('BUS-0001')],
            }))
            assertEq(result.partII.line13.value, 142900n, 'Table A-1, 7-year, year 1')
            assertEq(result.partII.line28.value, 142900n, 'and it is the whole of line 28')
            assertEq(result.partII.line31.value, 457100n, '$6,000.00 - $1,429.00')
            // Provenance: the line cites the register, by hash and by the path
            // the amount travelled. A rule string with the destination erased
            // is the mutation AGENTS.md records surviving a whole suite.
            const source = result.partII.line13.sources[0]
            assert(source !== undefined, 'line 13 must cite something')
            assertEq(source?.documentHash, 'sha256-register-a')
            assertEq(source?.boxPath, 'assets -> Form 4562 line 22')
        },
        /**
         * THE CONTROL: the same business with no register. Line 13 is the
         * documented zero it has always been, and line 31 is the whole
         * $6,000.00 — so the leaf above is evidence about the DOCUMENT rather
         * than about the business.
         */
        withoutARegisterLineThirteenIsADocumentedZero: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
            }))
            assertEq(result.partII.line13.value, 0n)
            assertEq(result.partII.line31.value, 600000n)
            assertEq(result.form4562, undefined,
                'and no Form 4562 was completed at all, which is not the same as one of zeros')
        },
        /**
         * A register whose `accountNumber` names a different activity is
         * REFUSED, not applied: depreciating one activity's assets against
         * another's receipts moves a real deduction onto the wrong Schedule C.
         */
        aRegisterForADifferentActivityRefuses: () => {
            const message = refusal(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [registerDoc('BUS-0002')],
            })).message
            assert(message.includes('BUS-0002'), ['must quote the register\'s account number', message])
            assert(message.includes('BUS-0001'), ['and the business\'s', message])
        },
        /** A second register is a second Form 4562, and this engine computes one. */
        twoRegistersRefuseNamingBoth: () => {
            const message = refusal(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [registerDoc('BUS-0001'), secondRegisterDoc],
            })).message
            assert(message.includes('software consulting'), ['must name the first', message])
            assert(message.includes('residential rental'), ['must name the second', message])
            assert(message.includes('mid-quarter'), ['must say why merging is wrong', message])
        },
        /**
         * **A register NOTHING on the return claims refuses rather than being
         * ignored, and this is the leaf that matters most.** Silently dropping
         * it would compute a Schedule C that is right and leave the
         * depreciation nowhere, which is exactly the silent zero this engine
         * exists not to produce.
         *
         * The message named "Schedule E Part I" as an unmodeled destination
         * until that part shipped. It now names both destinations, because
         * both exist, and the CONTROL below is what the wiring added: a
         * register whose account number names a stored
         * `vnd.fjs.rental_property` is Schedule E's, and Schedule C neither
         * depreciates it nor refuses it.
         */
        aRegisterNothingClaimsRefuses: () => {
            const message = refusal(run({
                assetRegisters: [registerDoc('BUS-0001')],
            })).message
            assert(message.includes('Schedule E line 18'),
                ['must name the OTHER printed line a register can reach', message])
            assert(message.includes('Schedule C line 13'), ['and this one', message])
            assert(message.includes('vnd.fjs.rental_property'),
                ['and what to store instead', message])
            assert(message.includes('BUS-0001'), ['and which register', message])
        },
        /**
         * ★ **THE CONTROL FOR THE FILTER**, and it cannot be built inside
         * `fjs/schedule/e/part_i`: only a Schedule C execution can show that
         * a rental register is INVISIBLE here. A return with one rental
         * property, its matching register and no business at all computes a
         * Schedule C of documented zeros — `filed: false`, `form4562:
         * undefined` — rather than the refusal above.
         */
        aRegisterClaimedByARentalPropertyIsNotThisSchedulesAtAll: () => {
            const outcome = run({
                assetRegisters: [registerDoc('BUS-0001')],
                rentalProperties: [{
                    documentHash: 'sha256-rental-a',
                    value: {
                        dialect: 'vnd.fjs.rental_property',
                        recipientTin: '222-22-2222',
                        accountNumber: 'BUS-0001',
                        taxYear: 2025,
                        propertyType: 'singleFamilyResidence',
                        physicalAddress: '18 Alder Street, Wells, ME 04090',
                        fairRentalDays: 365,
                        personalUseDays: 0,
                        rentsReceived: '24000.00',
                        entries: [],
                    },
                }],
            })
            assert(outcome.kind === 'ok', ['a rental register is not Schedule C\'s', outcome])
            if (outcome.kind !== 'ok') { throw ['a rental register is not Schedule C\'s', outcome] }
            assertEq(outcome.filed, false, 'no business, so no Schedule C is filed')
            assertEq(outcome.form4562, undefined, 'and no Form 4562 is computed here')
            assertEq(outcome.partII.line13.value, 0n, 'Schedule C line 13 stays a documented zero')
        },
        /**
         * Form 4562's own refusals are threaded out VERBATIM rather than
         * summarized — a Schedule C short by the depreciation is the failure
         * this whole path exists to prevent.
         */
        formFortyFiveSixtyTwosRefusalsReachTheCaller: () => {
            const listed = refusal(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [{
                    ...registerDoc('BUS-0001'),
                    value: {
                        ...registerDoc('BUS-0001').value,
                        assets: registerDoc('BUS-0001').value.assets.map(asset => ({
                            ...asset, listedProperty: /** @type {const} */ (true),
                        })),
                    },
                }],
            })).message
            assert(listed.includes('§280F'), ['Part V\'s refusal, verbatim', listed])
            const uncertified = refusal(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [{
                    ...registerDoc('BUS-0001'),
                    value: {
                        ...registerDoc('BUS-0001').value,
                        priorYearSection179CarryoverIsZero: undefined,
                    },
                }],
            })).message
            assert(uncertified.includes('line 10'), ['line 10\'s refusal, verbatim', uncertified])
        },
        /**
         * A hand-entered `depreciationAndSection179` expense entry STILL
         * refuses, and the corrected remedy says why: it would be counted
         * twice, once from the register and once from the entry.
         */
        aHandEnteredDepreciationEntryStillRefuses: () => {
            const message = refusal(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([entryOf('depreciationAndSection179')('500.00')])],
                assetRegisters: [registerDoc('BUS-0001')],
            })).message
            assert(message.includes('TWICE'), ['must say why an entry is refused now', message])
            assert(message.includes('vnd.fjs.asset_register'), ['and what to store instead', message])
        },
        /**
         * ★ **THE LEAF A MUTATION DEMANDED.** Forcing
         * `businessUseHundredthsOfPercent` to a flat 100% in
         * `fjs/document/asset_register`'s `depreciableAssets` — which lived in
         * THIS module when the mutation was run — left the ENTIRE suite green:
         * every fixture
         * in this repository used 100.00% business use, a June
         * placed-in-service month and the current tax year, so three of the
         * five facts that function extracts were unobservable. This leaf makes
         * all three bite at once.
         *
         * Two assets, every figure hand-computed off Publication 946:
         *
         * - A **60%-business** $10,000.00 seven-year asset placed in service in
         *   **November**. Its basis for depreciation is
         *   $10,000.00 × 60% = $6,000.00 (i4562 p10, column (c)), and because
         *   it is the whole of this year's additions and all of it falls in the
         *   last three months, the **mid-quarter** convention applies — which
         *   the engine derives and the register's own `convention` field only
         *   confirms. Table A-5 (fourth quarter), 7-year, year 1: **3.57%** of
         *   $6,000.00 = **$214.20**.
         * - A $5,000.00 five-year asset placed in service in **March 2022**,
         *   half-year, whose convention is TRANSCRIBED rather than derived
         *   because a register of assets still held cannot reconstruct 2022's
         *   own aggregate. 2025 is its fourth recovery year, and Table A-1's
         *   5-year column gives **11.52%** of $5,000.00 = **$576.00**, which
         *   lands on Form 4562 line 17 rather than line 19.
         *
         * Line 13 is $214.20 + $576.00 = **$790.20**, and line 31 is
         * $6,000.00 - $790.20 = **$5,209.80**.
         */
        aPartialBusinessUseAndAPriorYearAssetBothTravel: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [{
                    documentHash: 'sha256-register-mixed',
                    value: {
                        ...registerDoc('BUS-0001').value,
                        assets: [{
                            description: 'shared workstation',
                            datePlacedInService: '2025-11',
                            costOrOtherBasis: '10000.00',
                            businessUsePercentage: '60.00',
                            classification: 'sevenYear',
                            method: '200DB',
                            convention: 'MQ',
                            section168kStatus: 'electedOut',
                        }, {
                            description: 'older server',
                            datePlacedInService: '2022-03',
                            costOrOtherBasis: '5000.00',
                            businessUsePercentage: '100.00',
                            classification: 'fiveYear',
                            method: '200DB',
                            convention: 'HY',
                            section168kStatus: 'electedOut',
                        }],
                    },
                }],
            }))
            const form4562 = result.form4562
            assert(form4562 !== undefined, 'a register must produce a Form 4562')
            assertEq(form4562?.midQuarterConventionApplies, true,
                'all of this year\'s additions fell in the last three months')
            assertEq(form4562?.line19.c, 21420n, 'Table A-5, 7-year, year 1, on a 60% basis')
            assertEq(form4562?.line17, 57600n, 'Table A-1, 5-year, year 4, on the 2022 asset')
            assertEq(result.partII.line13.value, 79020n, '$214.20 + $576.00')
            assertEq(result.partII.line31.value, 520980n, '$6,000.00 - $790.20')
        },
        /**
         * THE CONTROL for the month and the percentage, one at a time: the
         * SAME seven-year asset at 100% business use in June is Table A-1's
         * 14.29% of the WHOLE $10,000.00 — $1,429.00 rather than $214.20. Two
         * facts changed and the figure moved by a factor of nearly seven, so
         * neither is being read as a constant.
         */
        theSameAssetInJuneAtFullBusinessUseIsADifferentFigure: () => {
            const result = ok(run({
                nonemployeeCompensationForms: [necDoc('6000.00')('sha256-nec-1')],
                businessExpenseForms: [businessDoc([])],
                assetRegisters: [registerDoc('BUS-0001')],
            }))
            assertEq(result.partII.line13.value, 142900n)
        },
    },
    businessCardinality: {
        // Schedule C is filed PER BUSINESS, and a second record is two
        // Schedule Cs. Refused, naming BOTH — a refusal naming one would leave
        // a reader unable to tell which record to remove.
        twoBusinessesRefuseNamingBoth: () => {
            const result = refusal(run({
                businessExpenseForms: [businessDoc([]), secondBusinessDoc],
            }))
            assert(
                result.message.includes('software consulting'),
                ['must name the first business', result.message])
            assert(
                result.message.includes('pottery'),
                ['must name the second business', result.message])
            assert(result.message.includes('§465'), ['must say why merging is wrong', result.message])
        },
        // THE CONTROL: either business ALONE computes. A cardinality check
        // written against the wrong comparison would refuse one record too.
        eitherBusinessAloneComputes: () => {
            assertEq(ok(run({ businessExpenseForms: [businessDoc([])] })).filed, true)
            assertEq(ok(run({ businessExpenseForms: [secondBusinessDoc] })).filed, true)
        },
        // THE CASE THAT ACTUALLY HAPPENS, and the reason printed line C is
        // stored at all: two businesses a taxpayer described identically on
        // line A. A refusal quoting `principalBusiness` twice would name
        // neither, so line C's trading name is appended when present — and
        // this is the leaf that makes `businessName` a field with a reader
        // rather than a field with a docstring.
        twoIdenticallyDescribedBusinessesAreStillToldApart: () => {
            /** @type {Stored<BusinessExpenses>} */
            const first = {
                documentHash: 'sha256-business-a',
                value: { ...businessDoc([]).value, principalBusiness: 'consulting', businessName: 'Acme' },
            }
            /** @type {Stored<BusinessExpenses>} */
            const second = {
                documentHash: 'sha256-business-b',
                value: {
                    ...businessDoc([]).value,
                    accountNumber: 'BUS-0002',
                    principalBusiness: 'consulting',
                    businessName: 'Beta',
                },
            }
            const result = refusal(run({ businessExpenseForms: [first, second] }))
            assert(result.message.includes('Acme'), ['must name the first trading name', result.message])
            assert(result.message.includes('Beta'), ['must name the second trading name', result.message])
        },
        // …and the CONTROL for that: a record with no line C renders no empty
        // parenthesis, because the printed form's own instruction is to leave
        // it blank when there is no separate business name.
        aBusinessWithNoTradingNameRendersNoEmptyParenthesis: () => {
            const result = refusal(run({
                businessExpenseForms: [businessDoc([]), secondBusinessDoc],
            }))
            assert(
                !result.message.includes('()'),
                ['an absent line C must not render as an empty parenthesis', result.message])
        },
    },

    directSales: {
        // Form 1099-NEC box 2, made load-bearing. It is the one box on that
        // form nothing read until this leaf existed, and its meaning is
        // consequential twice over: the goods are inventory (Part III), and
        // the resale proceeds appear on no information return (line 1).
        aCheckedBoxTwoRefusesNamingBothConsequences: () => {
            const reseller = directSalesDoc
            const result = refusal(run({
                nonemployeeCompensationForms: [reseller],
                businessExpenseForms: [businessDoc([])],
            }))
            assert(result.message.includes('box 2'), ['must name the box', result.message])
            assert(result.message.includes('Part III'), ['must name the inventory consequence', result.message])
            assert(
                result.message.includes('no information return'),
                ['must name the unreported-receipts consequence', result.message])
        },
        // It refuses with NO business record at all, for the same reason the
        // statutory-employee check does: the reseller who stores only their
        // Form 1099-NEC is exactly the case that would otherwise be silent.
        itRefusesEvenWithNoBusinessRecordAtAll: () => {
            const reseller = directSalesDoc
            assertEq(run({ nonemployeeCompensationForms: [reseller] }).kind, 'error')
        },
        // THE CONTROL: the identical Form 1099-NEC with box 2 ABSENT — the
        // shape of every other 1099-NEC fixture in this repository — computes.
        // A check written against box 2's presence in the object rather than
        // its value would refuse every freelancer.
        anOrdinaryFormWithNoBoxTwoComputes: () => {
            assertEq(ok(run({
                nonemployeeCompensationForms: [necDoc('350.00')('sha256-nec-a')],
                businessExpenseForms: [businessDoc([])],
            })).partII.line31.value, 35000n)
        },
    },

    grossReceiptsAssertion: {
        // §6041A's $600 threshold, converted from a silent understatement into
        // an explicit refusal. Without the assertion the schedule refuses,
        // naming the threshold and the field that fixes it.
        anAbsentAssertionRefusesNamingTheSixHundredDollarThreshold: () => {
            const withoutAssertion = {
                documentHash: 'sha256-business-a',
                value: {
                    ...businessDoc([]).value,
                    grossReceiptsFullyReportedOnForms1099Nec: undefined,
                },
            }
            const result = refusal(run({
                nonemployeeCompensationForms: [necDoc('48000.00')('sha256-nec-a')],
                businessExpenseForms: [withoutAssertion],
            }))
            assert(result.message.includes('§6041A'), ['must name the filing rule', result.message])
            assert(result.message.includes('$600'), ['must name the threshold', result.message])
            assert(
                result.message.includes('grossReceiptsFullyReportedOnForms1099Nec'),
                ['must name the field that fixes it', result.message])
            assert(
                result.message.includes('software consulting'),
                ['must name the business', result.message])
        },
        // THE CONTROL: the same return WITH the assertion computes. Every
        // other leaf in this file supplies it, so without this one the
        // refusal above could be firing for an unrelated reason.
        theSameReturnWithTheAssertionComputes: () => {
            assertEq(
                ok(run({
                    nonemployeeCompensationForms: [necDoc('399.99')('sha256-nec-a')],
                    businessExpenseForms: [businessDoc([])],
                })).partII.line31.value,
                39999n,
            )
        },
        // A Form 1099-NEC with no business record at all cannot produce a
        // Schedule C: printed line A is required and there is no assertion to
        // read. Refused, naming the dialect that supplies both.
        formsWithNoBusinessRecordRefuse: () => {
            const result = refusal(run({
                nonemployeeCompensationForms: [necDoc('48000.00')('sha256-nec-a')],
            }))
            assert(
                result.message.includes('vnd.fjs.business_expenses'),
                ['must name the record to store', result.message])
            assert(result.message.includes('line A'), ['must name the printed line', result.message])
        },
    },

    statutoryEmployee: {
        // An untouched W-2 box, made consequential by this phase. See this
        // module's docstring for the whole argument; the assertion here is
        // that the refusal names both halves of the problem — where the
        // amount belongs and where this engine puts it.
        aStatutoryEmployeeW2RefusesNamingBothLines: () => {
            const result = refusal(run({
                w2Forms: [{
                    documentHash: 'sha256-w2-statutory',
                    value: { ...bareW2Value, box1WagesTipsOtherCompensation: '30000.00', box13StatutoryEmployee: true },
                }],
            }))
            assert(result.message.includes('box 13'), ['must name the box', result.message])
            assert(result.message.includes('Schedule C line 1'), ['must name where the wages belong', result.message])
            assert(result.message.includes('1040 line 1a'), ['must name where this engine puts them', result.message])
        },
        // It refuses even with NO business documents — which is the case that
        // would otherwise stay silently overstated, and the reason the check
        // runs first.
        itRefusesEvenWithNoBusinessRecordAtAll: () => {
            const result = run({
                w2Forms: [{
                    documentHash: 'sha256-w2-statutory',
                    value: { ...bareW2Value, box13StatutoryEmployee: true },
                }],
            })
            assertEq(result.kind, 'error')
        },
        // THE CONTROL, and it is the important one: an ORDINARY W-2 — the
        // shape of nearly every W-2 in this repository — changes nothing. A
        // check written against box 13's PRESENCE rather than its value, or
        // against the wrong box 13 flag, would refuse a retirement-plan
        // participant, which is most employees.
        anOrdinaryW2ChangesNothing: () => {
            assertEq(ok(run({
                w2Forms: [{
                    documentHash: 'sha256-w2-a',
                    value: {
                        ...bareW2Value,
                        box1WagesTipsOtherCompensation: '30000.00',
                        box13RetirementPlan: true,
                        box13ThirdPartySickPay: true,
                    },
                }],
            })).filed, false)
        },
    },
}
