/**
 * Schedule F (Form 1040) — *Profit or Loss From Farming*, printed lines A
 * through 36.
 *
 * Spec:
 * [./todo/schedule-f-profit-or-loss-from-farming.md](./todo/schedule-f-profit-or-loss-from-farming.md),
 * written before this file. Everything below cites the printed 2025
 * `f1040sf.pdf` face or the `i1040sf.pdf` instructions by page.
 *
 * ## WHAT COMPUTES AND WHAT REFUSES, in one table
 *
 * | Printed | Computes? | From / why not |
 * |---|---|---|
 * | A principal crop or activity | stored | quoted by the second-Schedule-F refusal |
 * | B, D, F, G | not stored | no arithmetic reads them (`vnd.fjs.rental_property`'s rule) |
 * | C accounting method | stored | `cash` computes; `accrual` REFUSES at printed line 45 |
 * | E material participation | stored | `yes` computes; `no` REFUSES, on §1411 rather than §469 |
 * | 1a, 1b, 1c | ✔ | line 1c is a SUBTRACTION and may be negative |
 * | 2, 3a, 3b, 5a, 5b, 5c, 6a, 6b, 7, 8 | ✔ | `vnd.fjs.farm`, one printed amount per field |
 * | 4a | ✔ | `vnd.fjs.1099g` **box 7 + box 9**, plus the farm's own CCC-1099-G amounts |
 * | 4b | ✔ | line 4a less the market gain, when the §77 election was made |
 * | 6c deferral election | REFUSES by name | it moves income into a tax year this engine does not hold |
 * | 6d deferred from prior year | ✔, and its ABSENCE REFUSES | reading absence as zero would understate income |
 * | 9 gross income | ✔ | ten printed summands |
 * | 10 car and truck | REFUSES by name | Form 4562 Part V, which refuses (§274(d), §280F) |
 * | 12 conservation expenses | REFUSES by name | §175's 25%-of-gross-farm-income cap and its carryforward |
 * | 14 depreciation and §179 | ✔ | `vnd.fjs.asset_register` -> `fjs/form4562` line 22 (a STORED entry refuses) |
 * | 23 pension and profit-sharing | REFUSES by name | nothing distinguishes an employee's from the proprietor's |
 * | 11, 13, 15-22, 24a-32 | ✔ | `vnd.fjs.farm` entries, one category per printed line |
 * | 33 total expenses | ✔ | a plain sum; printed line 32f cannot go negative here |
 * | 34 net farm profit | ✔ **any profit, any break-even zero, and a LOSS at printed box 36a**; REFUSES a loss at box 36b | see below |
 * | 35 | reserved | the printed face says *"Reserved for future use"* |
 * | 36a/36b at risk | ✔ **read**, and it decides whether a loss computes | 36a computes, 36b refuses on §465 |
 * | Part III (37-50) | REFUSES by name | beginning and ending INVENTORY, and a valuation method |
 *
 * ## The net-loss decision, and where it stands after the Form 461 phase
 *
 * **A net loss on line 34 COMPUTES at printed box 36a. It REFUSES at printed box
 * 36b, on §465 alone.** A profit and a break-even zero compute as they always
 * did. i1040sf p9: *"If line 33 is more than line 9, don't enter your loss on
 * line 34 until you have applied the at-risk rules and the passive activity loss
 * rules […] You may also be required to file Form 461, which limits the
 * allowable loss."* Three things stood in the way of that sentence and two of
 * them are gone.
 *
 * **§465 and §469 are disposed of by i1040sf p10, in one sentence, on the
 * taxpayer's own two answers**: *"If all your investment amounts are at risk in
 * this activity, check box 36a. If you also checked the 'Yes' box on line E,
 * your remaining loss is your loss. The at-risk rules and the passive activity
 * loss rules don't apply."* `vnd.fjs.farm` stores both answers, which is exactly
 * what `vnd.fjs.business_expenses` does not — it carries no field for Schedule
 * C's printed line 32 at-risk box and none for material participation, so
 * `fjs/schedule/c`'s loss still refuses and this one does not. That difference
 * between two dialects is the whole reason one schedule moved and the other
 * could not. At box 36b, {@link netFarmLossRefusal} still refuses, and its
 * ground is §465 and Form 6198 alone.
 *
 * **§461(l) is computed now**, by `fjs/form461`, called from `fjs/schedule/1`
 * Part I after every schedule has produced its own printed line — which is
 * exactly i461's *Ordering Rules*: *"First, apply the at-risk rules; next, apply
 * the passive activity loss rules; and then apply the excess business loss
 * rules."* This schedule does not ask it, and could not: §461(l)(3)(A) measures
 * the AGGREGATE of every trade or business on the return, which one Schedule F
 * cannot see. A loss the limitation actually BINDS on still refuses, from
 * `fjs/form461`, because the disallowed amount is a §172 net operating loss
 * carryover this engine cannot hand to next year.
 *
 * **The binding statute is §461(l), and NOT §461(j)**, and that reading is what
 * made the aggregate the right question to ask. §461(j)'s excess FARM loss is
 * the provision a farm-shaped reading reaches for, and §461(l)(1)'s flush text
 * disapplies it for any noncorporate taxpayer in a year §461(l) applies — which
 * 2025 is (i1040sf p1, Reminders). The two have different thresholds and
 * different carryover consequences.
 *
 * **§199A(c)(2) was the third blocker, and it is gone for a reason worth
 * recording, because this docstring got it wrong.** It said the outbound
 * direction of that rule *"has no home at all"*. It has one: Form 8995 printed
 * line 16, *"Total qualified business (loss) carryforward"*, which
 * `fjs/form8995` has computed since Phase 28 and nothing read. Two things were
 * genuinely missing and the Form 461 phase supplied both — the zero-floor sat on
 * printed line 2 where the paper floors line 4, so a loss would have been
 * swallowed before reaching line 16; and line 16 reached no report field, so the
 * farmer could not transcribe it into next year's
 * `priorYearQualifiedBusinessLossCarryforward`. Above §199A(e)(2)'s threshold
 * `fjs/form8995a` refuses instead, because Form 8995-A has no such printed line
 * here.
 *
 * ## Printed line E answering "No" refuses, and the ground is §1411
 *
 * A farming activity in which the taxpayer does not materially participate is a
 * passive activity, and §1411(c)(1)(A)(ii) puts income from a passive trade or
 * business into net investment income. `fjs/form8960` computes printed line 4a
 * from Schedule E line 26 alone and carries line 4b as a structural zero, so a
 * passive farm PROFIT would escape the 3.8% net investment income tax entirely.
 * That is an understatement, which is the direction TAX-16 exists to prevent.
 *
 * This is `fjs/schedule/e/part_i`'s `selfRentalRefusal` reached by the same
 * route: a refusal that exists so a neighbouring form's zero stays structural.
 *
 * ## Line 14 comes from Form 4562, and the 150%-declining-balance premise is
 * stale
 *
 * §168(b)(2)(B) once required the 150% declining balance method for property
 * used in a farming business. TCJA §13203 struck it, and i4562 p11 says so:
 * *"For 3-, 5-, 7-, or 10-year property used in a farming business and placed in
 * service after 2017, in tax years ending after 2017, the 150% declining balance
 * method is no longer required. However, the 150% declining balance method will
 * continue to apply to any 15- or 20-year property used in a farming business to
 * which the straight line method does not apply."*
 *
 * `fjs/form4562/macrs` already enforces the surviving half — `fifteenYear` and
 * `twentyYear` are typed `methods: ['150DB', 'SL']` with no `200DB` at all — so
 * **`vnd.fjs.asset_register` is correct for farm property with no change**, and
 * forcing 150% DB on 3-, 5-, 7- and 10-year farm property would make it wrong.
 * Every farm recovery period i4562 pp10-11 names has an existing classification:
 * new farm machinery is `fiveYear`, used agricultural machinery and grain bins
 * and fences are `sevenYear`, single purpose agricultural structures and
 * fruit-or-nut-bearing trees are `tenYear`, and farm buildings are `twentyYear`.
 *
 * **Two farm-specific gaps are recorded rather than built**, because building
 * either would mean a second depreciation path:
 *
 * - **ADS is not representable** (`fjs/form4562` carries `line20` as a
 *   structural zero), and two farm situations mandate it — i1040sf p6's
 *   *"Electing farming business […] any property with a recovery period of 10
 *   years or more held by you must be depreciated under the alternative
 *   depreciation system"* (§163(j)(7)(C) through §168(g)(1)(G)), and i4562 p12's
 *   §263A(d)(3) election-out. Neither election is representable in any dialect,
 *   so neither can be detected, and both would make line 14 too LARGE.
 * - **§179 always refuses**, and it is the commonest farm depreciation election.
 *   That refusal is `fjs/form4562`'s own and travels out of here verbatim.
 *
 * ## One Schedule F per FARM, and a `vnd.fjs.business_expenses` beside it also
 * refuses
 *
 * A second `vnd.fjs.farm` refuses for `fjs/schedule/c`'s reason: merging two
 * farms is not an approximation of two Schedule Fs, it is a third return whose
 * single line 34 nets one farm's loss against the other's income.
 *
 * A `vnd.fjs.business_expenses` beside a `vnd.fjs.farm` refuses for a reason one
 * level up. Both are qualified trades or businesses, and Form 8995-A's W-2 wage
 * and unadjusted-basis limitations are figured PER BUSINESS — printed Schedule A
 * of Form 8995-A has three columns. `fjs/form1040/core` reads ONE business
 * record's `w2Wages` and `unadjustedBasisOfQualifiedProperty`, so a return
 * carrying both would apply one business's wages to two businesses' profit.
 * §461(l) aggregates the same way. Refusing is what makes the §199A wiring a
 * one-line sum in which exactly one of the two terms is ever non-zero.
 *
 * ## Form 1099-G box 7 and box 9 reach printed line 4a, and an ORPHAN one
 * refuses
 *
 * i1040sf p3 prints the routing: a Form 1099-G or CCC-1099-G is line 4a *"For
 * other agricultural program payments"*, and i1040sf p4 puts *"Market gain from
 * the repayment of a secured Commodity Credit Corporation (CCC) loan for less
 * than the original loan amount"* in line 4a's own list. So both boxes are read
 * here, and `vnd.fjs.1099g` stops refusing them.
 *
 * **A 1099-G carrying either box with NO `vnd.fjs.farm` stored refuses**
 * ({@link agriculturePaymentsWithoutAFarmRefusal}). Without that refusal,
 * removing the document-level one would drop the amount from the return
 * entirely — an understatement, and a silent one.
 *
 * ## What Part I does not model, and the direction of the omission
 *
 * **§126 excludable cost-share payments.** Printed line 4a's list includes
 * *"Cost-share payments (sight drafts)"* and *"Payments in the form of materials
 * (such as fertilizer or lime) or services (such as grading or building dams)"*,
 * and §126 excludes the *excludable portion* of certain conservation cost-share
 * payments — a present value Reg. §16A.126-1 figures from facts no document here
 * carries. This engine taxes the whole of line 4a less the market-gain
 * adjustment, which can only OVERSTATE tax. That is `fjs/schedule/c` line 2's
 * documented-zero direction, recorded rather than approximated.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../../exact/module.f.js'
import { formFortyFiveSixtyTwo } from '../../form4562/module.f.js'
import { depreciableAssets } from '../../document/asset_register/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { Farm } from '../../document/farm/module.f.js' */
/** @import { BusinessExpenses } from '../../document/business_expenses/module.f.js' */
/** @import { OneZeroNineNineG } from '../../document/1099g/module.f.js' */
/** @import { AssetRegister } from '../../document/asset_register/module.f.js' */
/** @import { Form4562Lines } from '../../form4562/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — the shape `fjs/schedule/c` and
 * `fjs/schedule/e/part_i` both use; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * A case this schedule will not compute — the same shape `fjs/schedule/c`,
 * `fjs/schedule/e` and `fjs/form4562` already return, so a caller threads it
 * through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleFRefusal
 */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly farmForms: readonly Stored<Farm>[],
 *   readonly businessExpenseForms: readonly Stored<BusinessExpenses>[],
 *   readonly unemploymentForms: readonly Stored<OneZeroNineNineG>[],
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 * }} ScheduleFInput
 */

// ── The printed expense vocabulary ───────────────────────────────────────────

/**
 * Printed lines 10 through 32, one row each, in printed order: the `category` a
 * `vnd.fjs.farm` entry may carry, the printed line it reaches, and the printed
 * label a report prints beside it.
 *
 * The four categories in {@link refusedCategories} are in this table even
 * though no entry may claim them, and that is deliberate: a stored entry is
 * refused BY NAME rather than silently ignored — `fjs/schedule/c`'s
 * `depreciationAndSection179` idiom, for the same reason. The printed lines
 * still exist; line 14's figure comes from Form 4562 and the other three are
 * figures this engine cannot complete.
 *
 * The vocabulary lives HERE and not on the dialect for the reason
 * `vnd.fjs.business_expenses` keeps `category` a free string: deciding which
 * printed line an expense reaches is deduction logic, and this module is that
 * logic.
 * @type {readonly { readonly category: string, readonly printedLine: string, readonly label: string }[]}
 */
export const farmExpenseLines = [
    { category: 'carAndTruck', printedLine: '10', label: 'car and truck expenses' },
    { category: 'chemicals', printedLine: '11', label: 'chemicals' },
    { category: 'conservationExpenses', printedLine: '12', label: 'conservation expenses' },
    { category: 'customHire', printedLine: '13', label: 'custom hire (machine work)' },
    { category: 'depreciationAndSection179', printedLine: '14', label: 'depreciation and section 179 expense' },
    { category: 'employeeBenefitPrograms', printedLine: '15', label: 'employee benefit programs other than on line 23' },
    { category: 'feed', printedLine: '16', label: 'feed' },
    { category: 'fertilizersAndLime', printedLine: '17', label: 'fertilizers and lime' },
    { category: 'freightAndTrucking', printedLine: '18', label: 'freight and trucking' },
    { category: 'gasolineFuelAndOil', printedLine: '19', label: 'gasoline, fuel, and oil' },
    { category: 'insuranceOtherThanHealth', printedLine: '20', label: 'insurance (other than health)' },
    { category: 'mortgageInterest', printedLine: '21a', label: 'interest: mortgage (paid to banks, etc.)' },
    { category: 'otherInterest', printedLine: '21b', label: 'interest: other' },
    { category: 'laborHired', printedLine: '22', label: 'labor hired (less employment credits)' },
    { category: 'pensionAndProfitSharingPlans', printedLine: '23', label: 'pension and profit-sharing plans' },
    { category: 'rentOrLeaseVehiclesMachineryEquipment', printedLine: '24a', label: 'rent or lease: vehicles, machinery, equipment' },
    { category: 'rentOrLeaseOtherBusinessProperty', printedLine: '24b', label: 'rent or lease: other (land, animals, etc.)' },
    { category: 'repairsAndMaintenance', printedLine: '25', label: 'repairs and maintenance' },
    { category: 'seedsAndPlants', printedLine: '26', label: 'seeds and plants' },
    { category: 'storageAndWarehousing', printedLine: '27', label: 'storage and warehousing' },
    { category: 'supplies', printedLine: '28', label: 'supplies' },
    { category: 'taxes', printedLine: '29', label: 'taxes' },
    { category: 'utilities', printedLine: '30', label: 'utilities' },
    { category: 'veterinaryBreedingAndMedicine', printedLine: '31', label: 'veterinary, breeding, and medicine' },
    { category: 'otherExpenses', printedLine: '32', label: 'other expenses' },
]

/**
 * Independently HAND-COUNTED off the printed face: lines 10 through 32 is
 * twenty-three printed numbers, and two of them print two boxes each — 21a/21b
 * *"Interest: Mortgage / Other"* and 24a/24b *"Rent or lease: Vehicles,
 * machinery, equipment / Other (land, animals, etc.)"*. Twenty-three plus two is
 * twenty-five.
 *
 * Deliberately NOT `farmExpenseLines.length` — a row silently dropped from the
 * table above would otherwise still pass every loop that iterates it
 * (AGENTS.md's fourth shipped defect).
 * @type {number}
 */
export const expectedFarmExpenseLineCount = 25

/**
 * The four categories that are RECOGNIZED in order to be refused, in printed
 * order. Each has its own refusal function naming its own reason; this list is
 * only the order they are checked in.
 * @type {readonly string[]}
 */
export const refusedCategories = [
    'carAndTruck', 'conservationExpenses', 'depreciationAndSection179',
    'pensionAndProfitSharingPlans',
]

/**
 * Independently HAND-COUNTED: printed lines 10, 12, 14 and 23. See
 * {@link refusedCategories}.
 * @type {number}
 */
export const expectedRefusedCategoryCount = 4

/**
 * §199A(d)(2)'s list is health, law, accounting, actuarial science, performing
 * arts, consulting, athletics, financial services, brokerage services, and
 * investing and trading. **Farming is on none of them**, so this is a legal fact
 * rather than a taxpayer assertion, and `vnd.fjs.farm` deliberately carries no
 * `specifiedServiceTradeOrBusiness` field for a filer to get wrong. The value is
 * one of `vnd.fjs.business_expenses`' own two exact strings, so
 * `fjs/form8995a` reads it through the vocabulary it already checks.
 * @type {string}
 */
export const farmingIsNotASpecifiedServiceTradeOrBusiness = 'notSpecifiedService'

// ── Local helpers ────────────────────────────────────────────────────────────
//
// Reimplemented rather than imported, under this tree's standing "reimplement
// an idiom you cannot import" precedent — `fjs/schedule/e/part_i` carries the
// same note above its own copies.

/**
 * A line that is zero because the taxpayer stored no farm.
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

/** One `(documentHash, boxPath)` pair as a dedup key. @type {(source: Source) => string} */
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
    assert(first !== undefined, ['a union of non-empty source tuples cannot be empty', lines.length])
    return [first, ...rest]
}

/** Sums a set of {@link ReportLine}s into one, with a unioned `sources`.
 * @type {(rule: string) => (lines: readonly ReportLine[]) => ReportLine}
 */
const totalLine = rule => lines => ({
    value: lines.reduce((total, line) => total + line.value, 0n),
    sources: unionSources(lines),
    rule,
})

/**
 * A line built from real document readings, falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied one.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (value: bigint) => (sources: readonly Source[]) => ReportLine}
 */
const documentLine = profile => rule => value => sources => {
    const [first, ...rest] = sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value, sources: [first, ...rest], rule }
}

/** The farm a refusal names: printed line A and the account number. @type {(farm: Farm) => string} */
const farmLabel = farm => `'${farm.accountNumber}' (${farm.principalCropOrActivity})`

// ── Refusals ─────────────────────────────────────────────────────────────────

/**
 * Two `vnd.fjs.farm` documents. Schedule F is filed per farming business, and
 * merging two is not an approximation of two Schedule Fs.
 * @type {(first: Farm) => (second: Farm) => ScheduleFRefusal}
 */
export const secondScheduleFRefusal = first => second => ({
    kind: 'error',
    message: `Schedule F: this return carries TWO vnd.fjs.farm documents — ${farmLabel(first)} and `
        + `${farmLabel(second)} — and this engine supports exactly one. Schedule F is filed per `
        + `farming business, so two records are two Schedule Fs, with two line 34s and two printed `
        + `line 36 at-risk determinations. Merging them is not an approximation of that: their `
        + `single line 34 would net one farm's loss against the other's income with neither at-risk `
        + `determination made, which is the arithmetic §465 exists to stop. Keep one, or wait for a `
        + `phase that files two (no phase yet)`,
})

/**
 * A `vnd.fjs.business_expenses` stored beside a `vnd.fjs.farm`. §199A and
 * §461(l) both aggregate across trades or businesses, and this engine carries
 * one business's facts.
 * @type {(farm: Farm) => (business: BusinessExpenses) => ScheduleFRefusal}
 */
export const farmBesideABusinessRefusal = farm => business => ({
    kind: 'error',
    message: `Schedule F: this return carries a farm, ${farmLabel(farm)}, AND a Schedule C `
        + `business, '${business.principalBusiness}'. Both are qualified trades or businesses, and `
        + `this engine cannot carry two through §199A: Form 8995-A figures the W-2 wage and `
        + `unadjusted-basis limitations PER BUSINESS — its printed Schedule A has three columns — `
        + `and fjs/form1040/core reads ONE record's w2Wages and `
        + `unadjustedBasisOfQualifiedProperty. Applying one business's wages to both businesses' `
        + `profit is not an approximation, it is a different return. §461(l) aggregates the same `
        + `way: i1040sf p9 defines an excess business loss over "all of your trades or businesses". `
        + `File one of them (no phase yet)`,
})

/**
 * Printed line C answered *"Accrual"*. The refusal is at printed line 45,
 * because that is the first printed line the filer cannot fill.
 * @type {(farm: Farm) => ScheduleFRefusal}
 */
export const accrualMethodRefusal = farm => ({
    kind: 'error',
    message: `Schedule F Part III line 45 for ${farmLabel(farm)}: printed line C says "Accrual", `
        + `and this engine computes only the cash method. i1040sf p1: an accrual-method filer `
        + `completes "Part I, line 9; Part II; and Part III", and printed Part III opens at line 45 `
        + `with "Inventory of livestock, produce, grains, and other products at BEGINNING of the `
        + `year" — last year's ending inventory, and this engine holds one tax year. Line 48 is the `
        + `same inventory at end of year, and neither is an amount that can simply be transcribed: `
        + `the printed footnote to line 49 says "If you use the unit-livestock-price method or the `
        + `farm-price method of valuing inventory and the amount on line 48 is larger than the `
        + `amount on line 47, subtract line 47 from line 48", so the SIGN of lines 47 through 50 `
        + `turns on a valuation method no document here carries. A CASH-method Schedule F computes `
        + `in full (Part III, no phase yet)`,
})

/**
 * Printed line E answered *"No"*. The ground is §1411, not §469 — see this
 * module's docstring.
 * @type {(farm: Farm) => ScheduleFRefusal}
 */
export const noMaterialParticipationRefusal = farm => ({
    kind: 'error',
    message: `Schedule F line E for ${farmLabel(farm)}: you answered "No" to "Did you materially `
        + `participate in the operation of this business", and this engine refuses it — including `
        + `on a PROFIT. A farming activity without material participation is a passive activity, `
        + `and §1411(c)(1)(A)(ii) puts income from a passive trade or business into NET INVESTMENT `
        + `INCOME. This engine computes printed Form 8960 line 4a from Schedule E line 26 alone and `
        + `carries line 4b as a structural zero, so admitting a passive farm would let its income `
        + `escape the 3.8% net investment income tax entirely — an UNDERSTATEMENT. On a loss the `
        + `same answer additionally triggers §469 and Form 8582, which needs every passive activity `
        + `on the return plus every prior-year unallowed loss. A farm that materially participated `
        + `computes (Form 8960 line 4b, no phase yet)`,
})

/**
 * Printed line 6c, the election to defer crop insurance proceeds into the
 * following year.
 * @type {(farm: Farm) => ScheduleFRefusal}
 */
export const cropInsuranceDeferralElectionRefusal = farm => ({
    kind: 'error',
    message: `Schedule F line 6c for ${farmLabel(farm)}: this record checks the election to defer `
        + `crop insurance proceeds to 2026, and this engine refuses it. The election moves income `
        + `into a tax year this engine does not hold, and it is ALL-OR-NOTHING per business — `
        + `i1040sf p4: "If you elect to defer any eligible crop insurance proceeds, you must defer `
        + `all such crop insurance proceeds (including federal crop disaster payments) from a `
        + `single trade or business." Printed line 6b would then be the taxpayer's own partition of `
        + `line 6a into deferred and not deferred, made under a statement attached to the return `
        + `that this engine does not produce, and a partition it cannot check is one it should not `
        + `silently accept. A filer who reports all their 2025 proceeds in 2025 computes (no phase `
        + `yet)`,
})

/**
 * Printed line 6d unstated. The direction is what makes absence a refusal
 * rather than a zero.
 * @type {(farm: Farm) => ScheduleFRefusal}
 */
export const priorYearCropInsuranceDeferralUnstatedRefusal = farm => ({
    kind: 'error',
    message: `Schedule F line 6d for ${farmLabel(farm)}: cropInsuranceProceedsDeferredFromPriorYear `
        + `is not stated, and this engine will not read that as zero. The printed line is "Amount `
        + `deferred from 2024" — crop insurance proceeds received in 2024 that the taxpayer elected `
        + `to include in income for 2025 — so it is INCOME this year, and reading silence as zero `
        + `would UNDERSTATE it. Set cropInsuranceProceedsDeferredFromPriorYear on the farm record: `
        + `"0.00" is the assertion that nothing was deferred from 2024, and it is a different `
        + `statement from leaving the field out`,
})

/**
 * A `category` no printed line names.
 * @type {(farm: Farm) => (category: string) => (description: string) => ScheduleFRefusal}
 */
export const unknownCategoryRefusal = farm => category => description => ({
    kind: 'error',
    message: `Schedule F: the vnd.fjs.farm for ${farmLabel(farm)} carries an expense in category `
        + `'${category}' (${description}), and printed Part II has no line for it. Lines 10 through `
        + `32 are the whole of the expense block — `
        + `${farmExpenseLines.map(row => row.category).join(', ')} — and an amount this engine `
        + `cannot place would either vanish from printed line 33 or land on a line the taxpayer did `
        + `not choose. Re-file it under a printed category`,
})

/**
 * Printed line 10, *"Car and truck expenses"*.
 * @type {(farm: Farm) => (amount: string) => ScheduleFRefusal}
 */
export const carAndTruckRefusal = farm => amount => ({
    kind: 'error',
    message: `Schedule F line 10 (car and truck expenses) for ${farmLabel(farm)} carries ${amount}, `
        + `and this engine refuses it. i1040sf p6: "If you claim any car or truck expenses (actual `
        + `or the standard mileage rate), you must provide the information requested on Form 4562, `
        + `Part V. Be sure to attach Form 4562 to your return." A vehicle is LISTED PROPERTY, and `
        + `fjs/form4562 refuses Part V by name — line 24a asks whether there is evidence to support `
        + `the business use claimed and 24b whether that evidence is written, which is §274(d) `
        + `substantiation no document here carries, and §280F caps a passenger automobile's `
        + `depreciation besides. Schedule C line 9 and Schedule E Part I line 6 give the same `
        + `answer for the same reason (no phase yet)`,
})

/**
 * Printed line 12, *"Conservation expenses"*. §175.
 * @type {(farm: Farm) => (amount: string) => ScheduleFRefusal}
 */
export const conservationExpenseRefusal = farm => amount => ({
    kind: 'error',
    message: `Schedule F line 12 (conservation expenses) for ${farmLabel(farm)} carries ${amount}, `
        + `and this engine refuses it. §175 caps the deduction, and i1040sf p6 states the cap in a `
        + `sentence this engine cannot evaluate: "Your deduction can't exceed 25% of your gross `
        + `income from farming (EXCLUDING certain gains from selling assets such as farm machinery `
        + `and land)." That base is not printed line 9 — it removes Form 4797 gains, and this `
        + `engine models no Form 4797 at all, so it cannot tell a farm whose line 9 includes such a `
        + `gain from one whose does not. The excess is not lost either: "the excess can be carried `
        + `forward and deducted in later tax years", which is a carryforward into a year this `
        + `engine does not hold. The expense is also deductible only if it is consistent with a `
        + `conservation plan approved by the Natural Resources Conservation Service, a fact no `
        + `document carries (Form 4797, no phase yet)`,
})

/**
 * Printed line 14, *"Depreciation and section 179 expense"*, as a stored ENTRY.
 * @type {(farm: Farm) => (amount: string) => ScheduleFRefusal}
 */
export const depreciationEntryRefusal = farm => amount => ({
    kind: 'error',
    message: `Schedule F line 14 (depreciation and section 179 expense) for ${farmLabel(farm)} `
        + `carries a stored entry of ${amount}, and this line is COMPUTED rather than transcribed: `
        + `it is Form 4562 line 22, off the vnd.fjs.asset_register whose accountNumber matches this `
        + `farm's. Accepting the entry as well would deduct the depreciation TWICE, once from the `
        + `register and once from the entry. Store a vnd.fjs.asset_register for this farm instead — `
        + `i4562 pp10-11 give every farm recovery period an existing classification: new farm `
        + `machinery is fiveYear, used agricultural machinery and grain bins and fences are `
        + `sevenYear, single purpose agricultural structures and fruit-or-nut-bearing trees are `
        + `tenYear, and farm buildings are twentyYear`,
})

/**
 * Printed line 23, *"Pension and profit-sharing plans"*. Schedule C line 19's
 * answer, unchanged.
 * @type {(farm: Farm) => (amount: string) => ScheduleFRefusal}
 */
export const pensionAndProfitSharingRefusal = farm => amount => ({
    kind: 'error',
    message: `Schedule F line 23 (pension and profit-sharing plans) for ${farmLabel(farm)} carries `
        + `${amount}, and this engine refuses it. i1040sf p7: "Enter your deduction for `
        + `contributions to employee pension, profit-sharing, or annuity plans. If the plan `
        + `included you as a self-employed person, enter contributions made as an employer on your `
        + `behalf on Schedule 1 (Form 1040), line 16, NOT on Schedule F." One stored amount cannot `
        + `say which of the two it is, and the two land on different printed lines of different `
        + `forms: an employee's contribution reduces printed line 34 and therefore self-employment `
        + `tax, while the proprietor's own does not. Schedule C line 19 gives the same answer for `
        + `the same reason (no phase yet)`,
})

/**
 * Two `vnd.fjs.asset_register` documents matching ONE farm.
 * @type {(farm: Farm) => (first: string) => (second: string) => ScheduleFRefusal}
 */
export const twoRegistersForOneFarmRefusal = farm => first => second => ({
    kind: 'error',
    message: `Schedule F line 14: two vnd.fjs.asset_register documents — '${first}' and `
        + `'${second}' — carry the accountNumber of the farm ${farmLabel(farm)}. A separate Form `
        + `4562 is filed for each business or activity (i4562 p1), and the mid-quarter convention `
        + `is decided by an aggregate over ONE Form 4562's own additions, so merging two registers `
        + `would pick a convention neither activity is on. This engine computes one register per `
        + `farm`,
})

/**
 * A Form 1099-G carrying printed box 7 or box 9 with no `vnd.fjs.farm` stored.
 * @type {(documentHash: string) => (box: string) => (amount: string) => ScheduleFRefusal}
 */
export const agriculturePaymentsWithoutAFarmRefusal = documentHash => box => amount => ({
    kind: 'error',
    message: `Schedule F line 4a: the Form 1099-G '${documentHash}' reports ${amount} in `
        + `${box}, and this return stores no vnd.fjs.farm for it to reach. i1040sf p3 routes a `
        + `Form 1099-G or CCC-1099-G "For other agricultural program payments" to Schedule F line `
        + `4a, and i1040sf p4 puts "Market gain from the repayment of a secured Commodity Credit `
        + `Corporation (CCC) loan for less than the original loan amount" in that same line's list. `
        + `Without a Schedule F the amount reaches no printed line at all, and this engine will not `
        + `drop farm income in silence. Store a vnd.fjs.farm for the farming business these `
        + `payments belong to`,
})

/**
 * **Printed line 34 is a LOSS and printed box 36b is checked.** §465 alone, and
 * it is the ONLY thing that still stops a farm loss here.
 *
 * This function refused EVERY net farm loss until the Form 461 phase, on three
 * grounds in one message: §465 when box 36b was checked, §461(l) always, and
 * §199A(c)(2) always. Two of the three are gone and the third is unchanged:
 *
 * - **§461(l) is computed now.** `fjs/form461` aggregates the trade-or-business
 *   income and deductions of the whole return, and `fjs/schedule/1` Part I calls
 *   it. The old message said this engine *"cannot form the aggregate the
 *   threshold is compared against"* because it *"models no Form 4797 and
 *   computes Schedule 1 line 4 as a documented zero"* — that is exactly what
 *   printed Form 461 line 4 wants, and a documented zero for a line whose kind
 *   (`otherGainsOrLosses`) the scope guard refuses is a KNOWN zero rather than a
 *   missing figure. A loss that §461(l) actually LIMITS still refuses, from
 *   `fjs/form461` itself, where the threshold is.
 * - **§199A(c)(2)'s outbound carryforward has a home now.** Form 8995 printed
 *   line 16 computes it and `fjs/report/tax_return` prints it, so the farmer can
 *   transcribe it into next year's `priorYearQualifiedBusinessLossCarryforward`
 *   — the inbound field that has existed since Phase 28. Above §199A(e)(2)'s
 *   threshold `fjs/form8995a` refuses instead, because that page has no such
 *   printed line.
 * - **§465 is unchanged**, and printed box 36b is the taxpayer's own answer to
 *   it. i1040sf p10: *"the at-risk rules apply to your loss. Be sure to attach
 *   Form 6198 to your return."*
 *
 * §469 never appears here at all, for the reason it never did:
 * {@link noMaterialParticipationRefusal} has already turned away every farm that
 * answered "No" on printed line E, so a farm reaching this line is non-passive
 * by the taxpayer's own assertion, and i1040sf p10 then says in one sentence
 * that neither §465 nor §469 applies at box 36a.
 * @type {(farm: Farm) => (lossCents: bigint) => ScheduleFRefusal}
 */
export const netFarmLossRefusal = farm => lossCents => ({
    kind: 'error',
    message: `Schedule F line 34 for ${farmLabel(farm)} is a LOSS of `
        + `${centsToString(-lossCents)}, and you checked printed box 36b, "Some investment is not `
        + `at risk", so §465 applies BEFORE anything else: i1040sf p10 says "the at-risk rules `
        + `apply to your loss. Be sure to attach Form 6198 to your return." The amount you are at `
        + `risk for is a multi-year history of contributions, borrowings and prior deductions `
        + `that no document here carries, so the arithmetic loss is an UPPER BOUND on the `
        + `deductible loss and letting it reach Schedule 1 line 6 would understate the tax while `
        + `moving adjusted gross income and every figure that depends on it. Checking printed box `
        + `36a instead — "All investment is at risk" — COMPUTES: i1040sf p10 says "If you also `
        + `checked the Yes box on line E, your remaining loss is your loss. The at-risk rules and `
        + `the passive activity loss rules don't apply", and the §461(l) limitation that stands `
        + `behind them is computed on Form 461 (fjs/form461). A PROFIT computes, a break-even `
        + `zero computes, and so does a loss at box 36a (Form 6198 and the §465 at-risk rules, no `
        + `phase yet)`,
})

// ── The whole schedule ───────────────────────────────────────────────────────

/**
 * Printed Schedule F, complete.
 *
 * `filed` is `false` for a return with no `vnd.fjs.farm` — every line is a
 * documented zero citing the profile's `declaredKinds`, so PROV-01 holds and a
 * return that never had a farm computes exactly what it computed before this
 * module existed. `fjs/form1040/core` reads it to decide whether §199A has a
 * trade or business at all, exactly as it reads `fjs/schedule/c`'s.
 *
 * `alternativeMinimumTaxAdjustmentCents` is the §56(a)(1) adjustment of the ONE
 * Form 4562 this schedule completed, carried out because `fjs/form1040/core` is
 * the only place a register may reach Form 6251 line 2l and there must be
 * exactly one execution per register.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly filed: boolean,
 *   readonly line1a: ReportLine, readonly line1b: ReportLine, readonly line1c: ReportLine,
 *   readonly line2: ReportLine,
 *   readonly line3a: ReportLine, readonly line3b: ReportLine,
 *   readonly line4a: ReportLine, readonly line4b: ReportLine,
 *   readonly line5a: ReportLine, readonly line5b: ReportLine, readonly line5c: ReportLine,
 *   readonly line6a: ReportLine, readonly line6b: ReportLine, readonly line6d: ReportLine,
 *   readonly line7: ReportLine, readonly line8: ReportLine, readonly line9: ReportLine,
 *   readonly line10: ReportLine, readonly line11: ReportLine, readonly line12: ReportLine,
 *   readonly line13: ReportLine, readonly line14: ReportLine, readonly line15: ReportLine,
 *   readonly line16: ReportLine, readonly line17: ReportLine, readonly line18: ReportLine,
 *   readonly line19: ReportLine, readonly line20: ReportLine,
 *   readonly line21a: ReportLine, readonly line21b: ReportLine,
 *   readonly line22: ReportLine, readonly line23: ReportLine,
 *   readonly line24a: ReportLine, readonly line24b: ReportLine,
 *   readonly line25: ReportLine, readonly line26: ReportLine, readonly line27: ReportLine,
 *   readonly line28: ReportLine, readonly line29: ReportLine, readonly line30: ReportLine,
 *   readonly line31: ReportLine, readonly line32: ReportLine,
 *   readonly line33: ReportLine, readonly line34: ReportLine,
 *   readonly form4562: Form4562Lines | undefined,
 *   readonly alternativeMinimumTaxAdjustmentCents: bigint,
 * }} ScheduleF
 */

/** @typedef {ScheduleF | ScheduleFRefusal} ScheduleFOutcome */

/**
 * Every printed line of a Schedule F that was not filed, as documented zeros.
 * Split out so the not-filed arm cannot drift from the filed one's field set —
 * `tsc` reports a missing line as an excess/missing property at the two spread
 * sites rather than letting one arm quietly carry fewer lines than the other.
 * @type {(line: (printed: string) => (label: string) => ReportLine) => Omit<ScheduleF, 'kind' | 'filed' | 'form4562' | 'alternativeMinimumTaxAdjustmentCents'>}
 */
const emptyScheduleFLines = line => ({
    line1a: line('1a')('sales of purchased livestock and other resale items'),
    line1b: line('1b')('cost or other basis of purchased livestock or other items'),
    line1c: line('1c')('line 1a less line 1b'),
    line2: line('2')('sales of livestock, produce, grains, and other products you raised'),
    line3a: line('3a')('cooperative distributions (Forms 1099-PATR)'),
    line3b: line('3b')('cooperative distributions, taxable amount'),
    line4a: line('4a')('agricultural program payments'),
    line4b: line('4b')('agricultural program payments, taxable amount'),
    line5a: line('5a')('CCC loans reported under election'),
    line5b: line('5b')('CCC loans forfeited'),
    line5c: line('5c')('CCC loans forfeited, taxable amount'),
    line6a: line('6a')('crop insurance proceeds received in 2025'),
    line6b: line('6b')('crop insurance proceeds, taxable amount'),
    line6d: line('6d')('crop insurance proceeds deferred from 2024'),
    line7: line('7')('custom hire (machine work) income'),
    line8: line('8')('other income'),
    line9: line('9')('gross income'),
    line10: line('10')('car and truck expenses'),
    line11: line('11')('chemicals'),
    line12: line('12')('conservation expenses'),
    line13: line('13')('custom hire (machine work)'),
    line14: line('14')('depreciation and section 179 expense'),
    line15: line('15')('employee benefit programs other than on line 23'),
    line16: line('16')('feed'),
    line17: line('17')('fertilizers and lime'),
    line18: line('18')('freight and trucking'),
    line19: line('19')('gasoline, fuel, and oil'),
    line20: line('20')('insurance (other than health)'),
    line21a: line('21a')('interest: mortgage (paid to banks, etc.)'),
    line21b: line('21b')('interest: other'),
    line22: line('22')('labor hired (less employment credits)'),
    line23: line('23')('pension and profit-sharing plans'),
    line24a: line('24a')('rent or lease: vehicles, machinery, equipment'),
    line24b: line('24b')('rent or lease: other (land, animals, etc.)'),
    line25: line('25')('repairs and maintenance'),
    line26: line('26')('seeds and plants'),
    line27: line('27')('storage and warehousing'),
    line28: line('28')('supplies'),
    line29: line('29')('taxes'),
    line30: line('30')('utilities'),
    line31: line('31')('veterinary, breeding, and medicine'),
    line32: line('32')('other expenses'),
    line33: line('33')('total expenses'),
    line34: line('34')('net farm profit or loss'),
})

/**
 * Printed Schedule F, lines A through 34, for the one stored `vnd.fjs.farm`.
 *
 * The check order is stated here because it is the order a filer meets the
 * refusals in, and it is deliberate: the whole-return shape first (two farms, a
 * farm beside a business), then the two printed HEADER answers that decide
 * whether the form can be completed at all (line C, line E), then the record's
 * own shape (an unfillable printed line, then a category no line names, then the
 * four categories that name a line this engine cannot complete), then the
 * register, then the arithmetic, and the LOSS last — because a loss refusal
 * quotes a figure that only exists once every line above it has been built.
 * @type {(input: ScheduleFInput) => ScheduleFOutcome}
 */
export const scheduleF = input => {
    const { profile, farmForms, businessExpenseForms, unemploymentForms, assetRegisters } = input
    const zero = profileDeclaredZeroLine(profile)
    const [firstFarm, secondFarm] = farmForms
    if (firstFarm !== undefined && secondFarm !== undefined) {
        return secondScheduleFRefusal(firstFarm.value)(secondFarm.value)
    }
    if (firstFarm === undefined) {
        // No farm. Every Form 1099-G box that would have reached printed line
        // 4a is an ORPHAN, and dropping it would understate income in silence.
        for (const form of unemploymentForms) {
            for (const [box, amount] of /** @type {readonly (readonly [string, string | undefined])[]} */ ([
                ['box 7 (box7AgriculturePayments)', form.value.box7AgriculturePayments],
                ['box 9 (box9MarketGain)', form.value.box9MarketGain],
            ])) {
                // A present-but-ZERO box is not an orphan: zero reaches no
                // printed line whether or not a Schedule F exists, and refusing
                // it would reject the common transcript that prints 0.00 in an
                // unused box. `vnd.fjs.1099g`'s own unmodeled-box loop takes the
                // same position, and re-parses for the same reason: '0', '0.00'
                // and '-0.00' are all zero and only the parse knows that.
                if (amount === undefined || centsFromString(amount) === 0n) {
                    continue
                }
                return agriculturePaymentsWithoutAFarmRefusal(form.documentHash)(box)(amount)
            }
        }
        const emptyLine = /** @type {(printed: string) => (label: string) => ReportLine} */ (
            printed => label => zero(`Schedule F line ${printed} (${label})`))
        return {
            kind: 'ok',
            filed: false,
            ...emptyScheduleFLines(emptyLine),
            form4562: undefined,
            alternativeMinimumTaxAdjustmentCents: 0n,
        }
    }
    const [firstBusiness] = businessExpenseForms
    if (firstBusiness !== undefined) {
        return farmBesideABusinessRefusal(firstFarm.value)(firstBusiness.value)
    }
    const farm = firstFarm.value
    if (farm.accountingMethod === 'accrual') {
        return accrualMethodRefusal(farm)
    }
    if (farm.materiallyParticipated === 'no') {
        return noMaterialParticipationRefusal(farm)
    }
    if (farm.electionToDeferCropInsuranceProceeds === true) {
        return cropInsuranceDeferralElectionRefusal(farm)
    }
    const deferredFromPriorYear = farm.cropInsuranceProceedsDeferredFromPriorYear
    if (deferredFromPriorYear === undefined) {
        return priorYearCropInsuranceDeferralUnstatedRefusal(farm)
    }
    for (const entry of farm.entries) {
        if (!farmExpenseLines.some(row => row.category === entry.category)) {
            return unknownCategoryRefusal(farm)(entry.category)(entry.description)
        }
    }
    for (const category of refusedCategories) {
        const entry = farm.entries.find(candidate => candidate.category === category)
        if (entry === undefined) {
            continue
        }
        return category === 'carAndTruck'
            ? carAndTruckRefusal(farm)(entry.amount)
            : category === 'conservationExpenses'
                ? conservationExpenseRefusal(farm)(entry.amount)
                : category === 'depreciationAndSection179'
                    ? depreciationEntryRefusal(farm)(entry.amount)
                    : pensionAndProfitSharingRefusal(farm)(entry.amount)
    }
    // Printed line 14. The register whose accountNumber matches THIS farm.
    const matching = assetRegisters.filter(
        register => register.value.accountNumber === farm.accountNumber)
    const [firstRegister, secondRegister] = matching
    if (firstRegister !== undefined && secondRegister !== undefined) {
        return twoRegistersForOneFarmRefusal(farm)(
            firstRegister.value.businessOrActivity)(secondRegister.value.businessOrActivity)
    }
    const line14Rule = 'Schedule F line 14 (depreciation and section 179 expense)'
    /** @type {Form4562Lines | undefined} */
    let form4562 = undefined
    /** @type {ReportLine} */
    let line14 = zero(line14Rule)
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
        line14 = documentLine(profile)(line14Rule)(outcome.line22)([{
            documentHash: firstRegister.documentHash,
            boxPath: 'assets -> Form 4562 line 22',
            value: centsToString(outcome.line22),
        }])
    }
    /** One stored printed Part I amount, with its own source. @type {(field: string) => (value: string | undefined) => (printed: string) => (label: string) => ReportLine} */
    const amountLine = field => value => printed => label => documentLine(profile)(
        `Schedule F line ${printed} (${label})`)(
        value === undefined ? 0n : centsFromString(value))(
        value === undefined ? [] : [{
            documentHash: firstFarm.documentHash,
            boxPath: field,
            value,
        }])
    const line1a = amountLine('salesOfPurchasedLivestockAndOtherResaleItems')(
        farm.salesOfPurchasedLivestockAndOtherResaleItems)('1a')(
        'sales of purchased livestock and other resale items')
    const line1b = amountLine('costOrOtherBasisOfPurchasedItems')(
        farm.costOrOtherBasisOfPurchasedItems)('1b')(
        'cost or other basis of purchased livestock or other items')
    // 1c. "Subtract line 1b from line 1a." No floor on the printed page: a
    //     farm that sold resale livestock for less than it paid reports a
    //     negative line 1c, and printed line 9 adds it as it stands.
    const line1c = {
        value: line1a.value - line1b.value,
        sources: unionSources([line1a, line1b]),
        rule: 'Schedule F line 1c (line 1a less line 1b)',
    }
    const line2 = amountLine('salesOfRaisedProductsAndLivestock')(
        farm.salesOfRaisedProductsAndLivestock)('2')(
        'sales of livestock, produce, grains, and other products you raised')
    const line3a = amountLine('cooperativeDistributions')(farm.cooperativeDistributions)('3a')(
        'cooperative distributions (Forms 1099-PATR)')
    const line3b = amountLine('cooperativeDistributionsTaxableAmount')(
        farm.cooperativeDistributionsTaxableAmount)('3b')('cooperative distributions, taxable amount')
    // 4a. "Agricultural program payments." Form 1099-G box 7 AND box 9, summed
    //     across every stored form, plus the farm's own assertion for a
    //     CCC-1099-G or an in-kind payment no Form 1099-G reports. i1040sf p3
    //     routes the form; i1040sf p4 puts the market gain in this line's list.
    /** @type {Source[]} */
    const line4aSources = []
    let line4aCents = 0n
    let marketGainCents = 0n
    for (const form of unemploymentForms) {
        for (const [field, amount] of /** @type {readonly (readonly [string, string | undefined])[]} */ ([
            ['box7AgriculturePayments', form.value.box7AgriculturePayments],
            ['box9MarketGain', form.value.box9MarketGain],
        ])) {
            if (amount === undefined) {
                continue
            }
            const cents = centsFromString(amount)
            line4aCents = line4aCents + cents
            if (field === 'box9MarketGain') {
                marketGainCents = marketGainCents + cents
            }
            line4aSources.push({ documentHash: form.documentHash, boxPath: field, value: amount })
        }
    }
    const asserted = farm.agriculturalProgramPaymentsNotReportedOnForm1099G
    if (asserted !== undefined) {
        line4aCents = line4aCents + centsFromString(asserted)
        line4aSources.push({
            documentHash: firstFarm.documentHash,
            boxPath: 'agriculturalProgramPaymentsNotReportedOnForm1099G',
            value: asserted,
        })
    }
    const line4a = documentLine(profile)(
        'Schedule F line 4a (agricultural program payments)')(line4aCents)(line4aSources)
    // 4b. "Taxable amount." i1040sf p4: "don't report the market gain shown on
    //     Form CCC-1099-G on line 4b if you elected to report CCC loan proceeds
    //     as income in the year received. No gain results from redemption of the
    //     commodity because you previously reported the CCC loan proceeds as
    //     income. […] However, if you didn't report the CCC loan proceeds under
    //     the election, you must report the market gain on line 4b."
    const electedToReportCccProceeds =
        farm.commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection === true
    const line4b = {
        ...line4a,
        value: line4a.value - (electedToReportCccProceeds ? marketGainCents : 0n),
        rule: 'Schedule F line 4b (agricultural program payments, taxable amount)',
    }
    const line5a = amountLine('commodityCreditCorporationLoansReportedUnderElection')(
        farm.commodityCreditCorporationLoansReportedUnderElection)('5a')(
        'CCC loans reported under election')
    const line5b = amountLine('commodityCreditCorporationLoansForfeited')(
        farm.commodityCreditCorporationLoansForfeited)('5b')('CCC loans forfeited')
    const line5c = amountLine('commodityCreditCorporationLoansForfeitedTaxableAmount')(
        farm.commodityCreditCorporationLoansForfeitedTaxableAmount)('5c')(
        'CCC loans forfeited, taxable amount')
    const line6a = amountLine('cropInsuranceProceedsReceived')(
        farm.cropInsuranceProceedsReceived)('6a')('crop insurance proceeds received in 2025')
    const line6b = amountLine('cropInsuranceProceedsTaxableAmount')(
        farm.cropInsuranceProceedsTaxableAmount)('6b')('crop insurance proceeds, taxable amount')
    const line6d = amountLine('cropInsuranceProceedsDeferredFromPriorYear')(
        deferredFromPriorYear)('6d')('crop insurance proceeds deferred from 2024')
    const line7 = amountLine('customHireIncome')(farm.customHireIncome)('7')(
        'custom hire (machine work) income')
    const line8 = amountLine('otherIncome')(farm.otherIncome)('8')('other income')
    // 9. "Gross income. Add amounts in the right column (lines 1c, 2, 3b, 4b,
    //    5a, 5c, 6b, 6d, 7, and 8)." TEN summands, named individually rather
    //    than reduced over a list, so a mutation that drops one reddens instead
    //    of shortening a loop nobody counted. Printed lines 1a, 1b, 3a, 5b and
    //    6a are NOT summands — they are the gross halves of the pairs.
    const line9 = totalLine('Schedule F line 9 (gross income)')([
        line1c, line2, line3b, line4b, line5a, line5c, line6b, line6d, line7, line8,
    ])
    /** The exact cents of every entry in ONE printed category, with one source each.
     * @type {(category: string) => ReportLine}
     */
    const expenseLine = category => {
        const row = farmExpenseLines.find(candidate => candidate.category === category)
        assert(row !== undefined, ['every expense line has a printed row', category])
        const sources = farm.entries
            .filter(entry => entry.category === category)
            .map(entry => ({
                documentHash: firstFarm.documentHash,
                boxPath: `entries[category=${category}]`,
                value: entry.amount,
            }))
        const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
        return documentLine(profile)(
            `Schedule F line ${row.printedLine} (${row.label})`)(value)(sources)
    }
    // Printed lines 10, 12 and 23 are STRUCTURAL zeros: an entry in any of the
    // three refuses above, so nothing can reach them. Not silent zeros — zeros
    // with a refusal standing in front of them.
    const line10 = zero('Schedule F line 10 (car and truck expenses)')
    const line11 = expenseLine('chemicals')
    const line12 = zero('Schedule F line 12 (conservation expenses)')
    const line13 = expenseLine('customHire')
    const line15 = expenseLine('employeeBenefitPrograms')
    const line16 = expenseLine('feed')
    const line17 = expenseLine('fertilizersAndLime')
    const line18 = expenseLine('freightAndTrucking')
    const line19 = expenseLine('gasolineFuelAndOil')
    const line20 = expenseLine('insuranceOtherThanHealth')
    const line21a = expenseLine('mortgageInterest')
    const line21b = expenseLine('otherInterest')
    const line22 = expenseLine('laborHired')
    const line23 = zero('Schedule F line 23 (pension and profit-sharing plans)')
    const line24a = expenseLine('rentOrLeaseVehiclesMachineryEquipment')
    const line24b = expenseLine('rentOrLeaseOtherBusinessProperty')
    const line25 = expenseLine('repairsAndMaintenance')
    const line26 = expenseLine('seedsAndPlants')
    const line27 = expenseLine('storageAndWarehousing')
    const line28 = expenseLine('supplies')
    const line29 = expenseLine('taxes')
    const line30 = expenseLine('utilities')
    const line31 = expenseLine('veterinaryBreedingAndMedicine')
    const line32 = expenseLine('otherExpenses')
    // 33. "Total expenses. Add lines 10 through 32f. If line 32f is negative,
    //     see instructions." A plain sum: `vnd.fjs.farm` refuses a negative
    //     entry amount, quoting it and naming §263A, so printed line 32f cannot
    //     come out negative here and the conditional has nothing to do.
    //
    //     **EQUIVALENT MUTANT, recorded rather than worked around.** REORDERING
    //     these twenty-five summands — the mutation run was moving `line14` to
    //     the end — cannot turn red at ANY input, because `totalLine` reduces
    //     them with `+` and addition is commutative. It compiled, it applied
    //     cleanly, and it left all 2,944 proofs green. That is AGENTS.md's "a
    //     mutation a neighbouring operation absorbs", where the neighbour is
    //     the reducer itself. The mutation that DOES bite is the deletion, and
    //     it was re-run: dropping `line14` reddens two leaves, one here and one
    //     in `fjs/form1040/core`. `unionSources` is not commutative — it is
    //     first-seen order — but no leaf asserts source ORDER, deliberately:
    //     asserting it would be asserting an accident of union order, which
    //     `fjs/schedule/c`'s own comment already says.
    const line33 = totalLine('Schedule F line 33 (total expenses)')([
        line10, line11, line12, line13, line14, line15, line16, line17, line18, line19,
        line20, line21a, line21b, line22, line23, line24a, line24b, line25, line26, line27,
        line28, line29, line30, line31, line32,
    ])
    // 34. "Net farm profit or (loss). Subtract line 33 from line 9."
    const line34Value = line9.value - line33.value
    // A net loss reaches printed line 36, and only box 36b stops it. See
    // {@link netFarmLossRefusal} for what the other two grounds were and where
    // each one went. §461(l) is NOT asked here: it is a limitation on the
    // AGGREGATE of every trade or business on the return, which this schedule
    // cannot see, and `fjs/schedule/1` Part I asks it once on Form 461 after
    // every schedule has produced its own line.
    if (line34Value < 0n && farm.investmentAtRisk === 'someNotAtRisk') {
        return netFarmLossRefusal(farm)(line34Value)
    }
    return {
        kind: 'ok',
        filed: true,
        line1a, line1b, line1c, line2, line3a, line3b, line4a, line4b,
        line5a, line5b, line5c, line6a, line6b, line6d, line7, line8, line9,
        line10, line11, line12, line13, line14, line15, line16, line17, line18, line19,
        line20, line21a, line21b, line22, line23, line24a, line24b, line25, line26, line27,
        line28, line29, line30, line31, line32,
        line33,
        line34: {
            value: line34Value,
            sources: unionSources([line9, line33]),
            rule: 'Schedule F line 34 (net farm profit or loss)',
        },
        form4562,
        alternativeMinimumTaxAdjustmentCents: form4562 === undefined
            ? 0n
            : form4562.alternativeMinimumTaxAdjustmentCents,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: ['farmIncomeOrLoss'],
}

/** @type {Stored<ReturnProfile>} */
const profileDocument = { documentHash: 'sha256-profile', value: minimalProfileValue }

/**
 * A cash-method farm that materially participated with all investment at risk,
 * $142,600.00 of raised products and nothing else. The BASE every fixture below
 * varies from.
 * @type {(overrides: Partial<Farm>) => (documentHash: string) => Stored<Farm>}
 */
const farmDocument = overrides => documentHash => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.farm',
        proprietorSsn: '222-22-2222',
        accountNumber: 'FARM-0001',
        taxYear: 2025,
        principalCropOrActivity: 'corn and soybeans',
        accountingMethod: 'cash',
        materiallyParticipated: 'yes',
        investmentAtRisk: 'allAtRisk',
        salesOfRaisedProductsAndLivestock: '142600.00',
        cropInsuranceProceedsDeferredFromPriorYear: '0.00',
        entries: [],
        ...overrides,
    },
})

/** @type {(category: string) => (amount: string) => Farm['entries'][number]} */
const entryOf = category => amount => ({
    category,
    datePaid: '2025-04-15',
    description: `${category} for the year`,
    amount,
})

/** A Form 1099-G carrying only what its schema requires. @type {OneZeroNineNineG} */
const bareForm1099G = {
    dialect: 'vnd.fjs.1099g',
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: '',
    taxYear: 2025,
    formRevision: '2025',
}

/** @type {(boxes: Partial<OneZeroNineNineG>) => (documentHash: string) => Stored<OneZeroNineNineG>} */
const form1099GDocument = boxes => documentHash => ({
    documentHash,
    value: { ...bareForm1099G, ...boxes },
})

/** @type {(input: Partial<ScheduleFInput>) => ScheduleFOutcome} */
const run = input => scheduleF({
    profile: profileDocument,
    farmForms: [],
    businessExpenseForms: [],
    unemploymentForms: [],
    assetRegisters: [],
    ...input,
})

/** @type {(outcome: ScheduleFOutcome) => ScheduleF} */
const ok = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Schedule F', outcome])
    return outcome
}

/** @type {(outcome: ScheduleFOutcome) => string} */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome.message
}

/**
 * A grain bin placed in service in **May 2025**, basis $84,000.00, 100% business
 * use, 7-year property under the 150% declining balance method, half-year.
 *
 * i4562 p10 puts *"grain bins"* in 7-year property. Publication 946 Table A-14
 * (7-year, 150% DB, half-year), year 1: **10.71%** — hand-typed off the printed
 * table, never from this engine: $84,000.00 x 10.71% = **$8,996.40**.
 *
 * **150DB rather than 200DB deliberately**, and it is the first fixture in this
 * repository at that method: i4562 p11's ELECTION *"For 3-, 5-, 7-, or 10-year
 * property eligible for the 200% declining balance method, you can make an
 * irrevocable election to use the 150% declining balance method"* is the one
 * every other fixture here declines. AGENTS.md's monoculture warning is why —
 * eight of the nine asset fixtures on this branch are 200DB or SL, and a
 * May placed-in-service month is the second thing no other fixture has.
 * @type {(documentHash: string) => Stored<AssetRegister>}
 */
const grainBinRegister = documentHash => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.asset_register',
        recipientTin: '222-22-2222',
        accountNumber: 'FARM-0001',
        taxYear: 2025,
        businessOrActivity: 'Hollow Creek Farm',
        everyDepreciableAssetIsListed: true,
        noDepreciablePropertyDisposedOfDuringTheYear: true,
        priorYearSection179CarryoverIsZero: true,
        assets: [{
            description: 'grain bin',
            datePlacedInService: '2025-05',
            costOrOtherBasis: '84000.00',
            businessUsePercentage: '100.00',
            classification: 'sevenYear',
            method: '150DB',
            convention: 'HY',
            section168kStatus: 'electedOut',
        }],
    },
})

export const proof = {
    // The printed expense block, counted off the page rather than off the
    // table: lines 10 through 32, with 21a/21b and 24a/24b each two boxes.
    theExpenseBlockIsTwentyFivePrintedLines: () => {
        assertEq(farmExpenseLines.length, expectedFarmExpenseLineCount)
        assertEq(new Set(farmExpenseLines.map(row => row.category)).size,
            expectedFarmExpenseLineCount)
        assertEq(new Set(farmExpenseLines.map(row => row.printedLine)).size,
            expectedFarmExpenseLineCount)
        // Hand-typed off the printed face: the first, the last, both split
        // pairs, and the four that refuse.
        /** @type {(category: string) => string} */
        const lineOf = category => {
            const row = farmExpenseLines.find(candidate => candidate.category === category)
            assert(row !== undefined, ['expected the row', category])
            assert(row !== undefined, ['expected the row', category])
            return row.printedLine
        }
        assertEq(lineOf('carAndTruck'), '10')
        assertEq(lineOf('chemicals'), '11')
        assertEq(lineOf('conservationExpenses'), '12')
        assertEq(lineOf('depreciationAndSection179'), '14')
        assertEq(lineOf('mortgageInterest'), '21a')
        assertEq(lineOf('otherInterest'), '21b')
        assertEq(lineOf('pensionAndProfitSharingPlans'), '23')
        assertEq(lineOf('rentOrLeaseVehiclesMachineryEquipment'), '24a')
        assertEq(lineOf('rentOrLeaseOtherBusinessProperty'), '24b')
        assertEq(lineOf('veterinaryBreedingAndMedicine'), '31')
        assertEq(lineOf('otherExpenses'), '32')
        assertEq(refusedCategories.length, expectedRefusedCategoryCount)
        // Every refused category is in the printed table: the property that
        // makes "refused by name rather than silently ignored" true.
        for (const category of refusedCategories) {
            assert(farmExpenseLines.some(row => row.category === category),
                ['a refused category with no printed row cannot be refused by name', category])
        }
        // §199A(d)(2) never reaches a farm, and the constant is one of
        // `vnd.fjs.business_expenses`' two exact strings.
        assertEq(farmingIsNotASpecifiedServiceTradeOrBusiness, 'notSpecifiedService')
    },
    // ── The computing cases ──────────────────────────────────────────────────
    aReturnWithNoFarmIsAScheduleOfDocumentedZeros: () => {
        const result = ok(run({}))
        assertEq(result.filed, false)
        for (const line of [result.line1c, result.line2, result.line4a, result.line4b,
            result.line9, result.line14, result.line33, result.line34]) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0]?.boxPath, 'declaredKinds')
        }
        assertEq(result.alternativeMinimumTaxAdjustmentCents, 0n)
        assertEq(result.form4562, undefined)
    },
    /**
     * ★ **THE WORKED CASE.** Every figure hand-typed off the printed page and
     * the arithmetic a reader can redo without running anything:
     *
     * ```
     *   1a  sales of purchased livestock                18,400.00
     *   1b  cost or other basis                         14,250.00
     *   1c  18,400.00 - 14,250.00                        4,150.00
     *   2   sales of raised products                   142,600.00
     *   3b  cooperative distributions, taxable           2,310.00
     *   4b  agricultural program payments, taxable       9,750.00
     *   6b  crop insurance proceeds, taxable            11,400.00
     *   7   custom hire income                           6,800.00
     *   8   other income                                 1,225.00
     *   9   4,150 + 142,600 + 2,310 + 9,750 + 11,400 + 6,800 + 1,225
     *                                                  178,235.00
     *
     *  11   chemicals                                    8,400.00
     *  16   feed                                        31,250.00
     *  17   fertilizers and lime                        22,900.00
     *  21a  mortgage interest                           14,600.00
     *  22   labor hired                                 26,500.00
     *  25   repairs and maintenance                      9,375.50
     *  26   seeds and plants                            17,200.00
     *  29   taxes                                        4,180.00
     *  30   utilities                                    6,240.00
     *  31   veterinary, breeding, and medicine           3,890.00
     *  33   total expenses                             144,535.50
     *  34   178,235.00 - 144,535.50                     33,699.50
     * ```
     */
    oneProfitableFarmComputesEveryPrintedLine: () => {
        const result = ok(run({
            farmForms: [farmDocument({
                salesOfPurchasedLivestockAndOtherResaleItems: '18400.00',
                costOrOtherBasisOfPurchasedItems: '14250.00',
                cooperativeDistributions: '2310.00',
                cooperativeDistributionsTaxableAmount: '2310.00',
                agriculturalProgramPaymentsNotReportedOnForm1099G: '9750.00',
                cropInsuranceProceedsReceived: '11400.00',
                cropInsuranceProceedsTaxableAmount: '11400.00',
                customHireIncome: '6800.00',
                otherIncome: '1225.00',
                entries: [
                    entryOf('chemicals')('8400.00'),
                    entryOf('feed')('31250.00'),
                    entryOf('fertilizersAndLime')('22900.00'),
                    entryOf('mortgageInterest')('14600.00'),
                    entryOf('laborHired')('26500.00'),
                    entryOf('repairsAndMaintenance')('9375.50'),
                    entryOf('seedsAndPlants')('17200.00'),
                    entryOf('taxes')('4180.00'),
                    entryOf('utilities')('6240.00'),
                    entryOf('veterinaryBreedingAndMedicine')('3890.00'),
                ],
            })('sha256-farm-a')],
        }))
        assertEq(result.filed, true)
        assertEq(result.line1a.value, 1840000n, 'line 1a $18,400.00')
        assertEq(result.line1b.value, 1425000n, 'line 1b $14,250.00')
        assertEq(result.line1c.value, 415000n, 'line 1c $4,150.00')
        assertEq(result.line2.value, 14260000n, 'line 2 $142,600.00')
        assertEq(result.line3a.value, 231000n, 'line 3a $2,310.00')
        assertEq(result.line3b.value, 231000n, 'line 3b $2,310.00')
        assertEq(result.line4a.value, 975000n, 'line 4a $9,750.00')
        assertEq(result.line4b.value, 975000n, 'line 4b $9,750.00')
        assertEq(result.line5a.value, 0n, 'line 5a no CCC loans')
        assertEq(result.line6a.value, 1140000n, 'line 6a $11,400.00')
        assertEq(result.line6b.value, 1140000n, 'line 6b $11,400.00')
        assertEq(result.line6d.value, 0n, 'line 6d nothing deferred from 2024')
        assertEq(result.line7.value, 680000n, 'line 7 $6,800.00')
        assertEq(result.line8.value, 122500n, 'line 8 $1,225.00')
        assertEq(result.line9.value, 17823500n, 'line 9 $178,235.00')
        assertEq(result.line11.value, 840000n, 'line 11 $8,400.00')
        assertEq(result.line14.value, 0n, 'no register, so no depreciation')
        assertEq(result.line16.value, 3125000n, 'line 16 $31,250.00')
        assertEq(result.line17.value, 2290000n, 'line 17 $22,900.00')
        assertEq(result.line21a.value, 1460000n, 'line 21a $14,600.00')
        assertEq(result.line21b.value, 0n, 'line 21b no other interest')
        assertEq(result.line22.value, 2650000n, 'line 22 $26,500.00')
        assertEq(result.line25.value, 937550n, 'line 25 $9,375.50')
        assertEq(result.line26.value, 1720000n, 'line 26 $17,200.00')
        assertEq(result.line29.value, 418000n, 'line 29 $4,180.00')
        assertEq(result.line30.value, 624000n, 'line 30 $6,240.00')
        assertEq(result.line31.value, 389000n, 'line 31 $3,890.00')
        assertEq(result.line33.value, 14453550n, 'line 33 $144,535.50')
        assertEq(result.line34.value, 3369950n, 'line 34 $33,699.50 -> Schedule 1 line 6')
        // Provenance: line 2 cites the farm document's own field.
        assertEq(result.line2.sources.length, 1)
        assertEq(result.line2.sources[0]?.documentHash, 'sha256-farm-a')
        assertEq(result.line2.sources[0]?.boxPath, 'salesOfRaisedProductsAndLivestock')
        assertEq(result.line2.sources[0]?.value, '142600.00')
        assertEq(result.line21a.sources[0]?.boxPath, 'entries[category=mortgageInterest]')
        // Printed line 34 cites the documents it is made of, never only the
        // profile: a filer must be able to see the receipts behind their farm
        // profit.
        const line34Boxes = result.line34.sources.map(source => source.boxPath)
        assert(line34Boxes.includes('salesOfRaisedProductsAndLivestock'),
            ['line 34 must carry the receipt it came from', line34Boxes])
        assert(line34Boxes.includes('entries[category=feed]'),
            ['and the expenses that reduced it', line34Boxes])
    },
    /**
     * ★ **FORM 1099-G BOX 7 AND BOX 9 REACH PRINTED LINE 4a**, which is the
     * whole of what makes those two boxes readable.
     *
     * i1040sf p3 routes a Form 1099-G "For other agricultural program payments"
     * to line 4a; i1040sf p4 puts the CCC market gain in that line's own list.
     *
     * ```
     *   4a  box 7  3,400.00  +  box 9  1,250.00  +  asserted 600.00 = 5,250.00
     *   4b  no §77 election, so the market gain IS taxable         = 5,250.00
     * ```
     */
    formTenNinetyNineGBoxSevenAndBoxNineReachPrintedLineFourA: () => {
        const result = ok(run({
            farmForms: [farmDocument({
                agriculturalProgramPaymentsNotReportedOnForm1099G: '600.00',
            })('sha256-farm-a')],
            unemploymentForms: [form1099GDocument({
                box7AgriculturePayments: '3400.00',
                box9MarketGain: '1250.00',
            })('sha256-1099g-a')],
        }))
        assertEq(result.line4a.value, 525000n, 'line 4a $5,250.00')
        assertEq(result.line4b.value, 525000n, 'no §77 election, so the market gain is taxable')
        assertEq(result.line9.value, 14785000n, '$142,600.00 + $5,250.00')
        // The provenance names BOTH boxes and the farm's own assertion.
        const boxes = result.line4a.sources.map(source => source.boxPath)
        assertEq(boxes.length, 3)
        assert(boxes.includes('box7AgriculturePayments'), ['box 7 must be cited', boxes])
        assert(boxes.includes('box9MarketGain'), ['box 9 must be cited', boxes])
        assert(boxes.includes('agriculturalProgramPaymentsNotReportedOnForm1099G'),
            ['and the CCC-1099-G amount no Form 1099-G reports', boxes])
        assertEq(result.line4a.sources[0]?.documentHash, 'sha256-1099g-a')
        // ★ **THE §77 ELECTION, and it moves line 4b by EXACTLY the market
        // gain.** i1040sf p4: "don't report the market gain shown on Form
        // CCC-1099-G on line 4b if you elected to report CCC loan proceeds as
        // income in the year received."
        const elected = ok(run({
            farmForms: [farmDocument({
                agriculturalProgramPaymentsNotReportedOnForm1099G: '600.00',
                commodityCreditCorporationLoanProceedsReportedAsIncomeUnderElection: true,
            })('sha256-farm-a')],
            unemploymentForms: [form1099GDocument({
                box7AgriculturePayments: '3400.00',
                box9MarketGain: '1250.00',
            })('sha256-1099g-a')],
        }))
        assertEq(elected.line4a.value, 525000n, 'line 4a is unchanged by the election')
        assertEq(elected.line4b.value, 400000n, '$5,250.00 less the $1,250.00 market gain')
        assertEq(elected.line9.value, 14660000n, '$142,600.00 + $4,000.00')
        // The election takes out the MARKET GAIN and nothing else: box 7 stays
        // taxable in full. Without this the assertion above would pass for an
        // election that zeroed line 4b outright.
        assertEq(elected.line4a.value - elected.line4b.value, 125000n,
            'the difference is exactly box 9')
        // Two Forms 1099-G are SUMMED, and both sources are cited.
        const two = ok(run({
            farmForms: [farmDocument({})('sha256-farm-a')],
            unemploymentForms: [
                form1099GDocument({ box7AgriculturePayments: '3400.00' })('sha256-1099g-a'),
                form1099GDocument({ box9MarketGain: '1250.00' })('sha256-1099g-b'),
            ],
        }))
        assertEq(two.line4a.value, 465000n, '$3,400.00 + $1,250.00')
        assertEq(two.line4a.sources.length, 2)
    },
    /**
     * ★ **LINE 14 OFF THE ASSET REGISTER, at Publication 946 Table A-14.**
     *
     * An $84,000.00 grain bin placed in service in May 2025 — i4562 p10 puts
     * grain bins in 7-year property. Table A-14, 7-year, **150% declining
     * balance**, half-year, year 1: **10.71%**, hand-typed off the printed
     * table. $84,000.00 x 10.71% = **$8,996.40**.
     *
     * ```
     *   9  gross income                                142,600.00
     *  14  depreciation, Form 4562 line 22               8,996.40
     *  33  total expenses                                8,996.40
     *  34  142,600.00 - 8,996.40                       133,603.60
     * ```
     *
     * §56(a)(1)(A) makes **no** AMT adjustment: `fjs/form4562` adjusts only an
     * asset at `200DB` that is `notQualifiedProperty`, and this one is `150DB`.
     */
    theRegisterReachesPrintedLineFourteenAtTableAFourteen: () => {
        const result = ok(run({
            farmForms: [farmDocument({})('sha256-farm-a')],
            assetRegisters: [grainBinRegister('sha256-register-a')],
        }))
        assertEq(result.line14.value, 899640n, 'Table A-14 150DB half-year year 1: 10.71%')
        assertEq(result.line33.value, 899640n, 'line 33 is the depreciation alone')
        assertEq(result.line34.value, 13360360n, 'line 34 $133,603.60')
        assertEq(result.line14.sources.length, 1)
        assertEq(result.line14.sources[0]?.documentHash, 'sha256-register-a')
        assertEq(result.line14.sources[0]?.boxPath, 'assets -> Form 4562 line 22')
        assertEq(result.line14.sources[0]?.value, '8996.40')
        assertEq(result.alternativeMinimumTaxAdjustmentCents, 0n,
            '150DB is not 200DB, so §56(a)(1)(A) adjusts nothing')
        assert(result.form4562 !== undefined, ['the completed Form 4562 travels out'])
        // A register that matches NOTHING is simply not this farm's: the
        // control that keeps the accountNumber match load-bearing.
        const unmatched = ok(run({
            farmForms: [farmDocument({})('sha256-farm-a')],
            assetRegisters: [{
                documentHash: 'sha256-register-b',
                value: { ...grainBinRegister('x').value, accountNumber: 'SOME-OTHER' },
            }],
        }))
        assertEq(unmatched.line14.value, 0n,
            'a register for another activity does not depreciate this farm')
        assertEq(unmatched.form4562, undefined)
    },
    /**
     * ★ **THE AMT ADJUSTMENT TRAVELS OUT.** The identical grain bin at `200DB`
     * — the election i4562 p11 lets a farmer decline — DOES produce a
     * §56(a)(1)(A) adjustment, and it has to reach `fjs/form1040/core` or the
     * alternative minimum tax is silently short for every farmer who
     * depreciates.
     *
     * Table A-1 (7-year, **200% DB**, half-year), year 1: **14.29%**.
     * $84,000.00 x 14.29% = **$12,003.60**. The AMT shadow is the same asset at
     * 150% DB, which is the $8,996.40 above, so the adjustment is
     * **$12,003.60 - $8,996.40 = $3,007.20**.
     */
    theAlternativeMinimumTaxAdjustmentTravelsOut: () => {
        const register = grainBinRegister('sha256-register-a')
        const [asset] = register.value.assets
        assert(asset !== undefined, ['expected the asset'])
        assert(asset !== undefined, ['expected the asset'])
        const result = ok(run({
            farmForms: [farmDocument({})('sha256-farm-a')],
            assetRegisters: [{
                documentHash: register.documentHash,
                value: {
                    ...register.value,
                    assets: [{ ...asset, method: '200DB', section168kStatus: 'notQualifiedProperty' }],
                },
            }],
        }))
        assertEq(result.line14.value, 1200360n, 'Table A-1 200DB half-year year 1: 14.29%')
        assertEq(result.alternativeMinimumTaxAdjustmentCents, 300720n,
            '$12,003.60 regular less $8,996.40 at 150% DB')
    },
    /**
     * ★ **A BREAK-EVEN ZERO COMPUTES, and it is not a loss.** $142,600.00 of
     * raised products against $142,600.00 of feed.
     */
    aBreakEvenFarmComputesAndIsNotALoss: () => {
        const result = ok(run({
            farmForms: [farmDocument({
                entries: [entryOf('feed')('142600.00')],
            })('sha256-farm-a')],
        }))
        assertEq(result.line34.value, 0n, 'break-even computes, and zero is not a loss')
        assertEq(result.filed, true)
    },
    // ── The refusals, each with its control ──────────────────────────────────
    refusals: {
        /**
         * ★ **THE ASYMMETRY, and it MOVED with the Form 461 phase.** Printed
         * box 36b refuses a net loss on §465; printed box 36a COMPUTES one.
         * The same farm, one cent past break-even, decided by one stored
         * answer — which is the only thing printed line 36 is read for, and
         * without this leaf the field would be stored and unread (the
         * `box13StatutoryEmployee` defect).
         *
         * Until this phase BOTH boxes refused, on §465 (36b only), §461(l)
         * (always) and §199A(c)(2) (always). `fjs/form461` computes the second
         * and `fjs/report/tax_return` records the third, so only §465 is left.
         */
        printedBoxThirtySixBRefusesOnSectionFourSixtyFiveAndThirtySixAComputes: () => {
            const notAtRisk = refusal(run({
                farmForms: [farmDocument({
                    investmentAtRisk: 'someNotAtRisk',
                    entries: [entryOf('feed')('142600.01')],
                })('sha256-farm-a')],
            }))
            assert(notAtRisk.includes('§465'), ['the at-risk statute', notAtRisk])
            assert(notAtRisk.includes('Form 6198'), ['the form to attach', notAtRisk])
            assert(notAtRisk.includes('box 36b'), ['the printed box that was checked', notAtRisk])
            assert(notAtRisk.includes('multi-year history'),
                ['why it cannot be computed', notAtRisk])
            assert(notAtRisk.includes('LOSS of 0.01'), ['the SIZE of the loss', notAtRisk])
            assert(notAtRisk.includes('line 34'), ['the printed line', notAtRisk])
            assert(notAtRisk.includes('FARM-0001'), ['which farm', notAtRisk])
            assert(notAtRisk.includes('corn and soybeans'), ['and printed line A', notAtRisk])
            // It must say what to do, and box 36a is the answer -- the remedy
            // that names a form which had ceased to be missing is the failure
            // this half exists to prevent.
            assert(notAtRisk.includes('box 36a'), ['and the box that computes', notAtRisk])
            assert(notAtRisk.includes('fjs/form461'),
                ['§461(l) is COMPUTED now and must not be named as a blocker', notAtRisk])
            // **THE CONTROL, and it is the whole point of the phase**: the
            // identical farm at box 36a computes a NEGATIVE line 34.
            const atRisk = ok(run({
                farmForms: [farmDocument({
                    entries: [entryOf('feed')('142600.01')],
                })('sha256-farm-a')],
            }))
            assertEq(atRisk.line34.value, -1n, 'one cent of loss, computed, at box 36a')
            assertEq(atRisk.filed, true)
            // And the second control, one cent the other way: break-even is not
            // a loss and never reaches printed line 36 at all.
            const evenOutcome = ok(run({
                farmForms: [farmDocument({
                    entries: [entryOf('feed')('142600.00')],
                })('sha256-farm-a')],
            }))
            assertEq(evenOutcome.line34.value, 0n, 'break-even computes')
        },
        /**
         * ★ **A REAL farm loss at box 36a, and its citations.** $142,600.00 of
         * raised products against $192,600.00 of feed is a $50,000.00 loss on
         * printed line 34, and the line must carry BOTH the receipt and the
         * expense that produced it — a computed loss that cited nothing would
         * be indistinguishable from a documented zero.
         */
        aFiftyThousandDollarFarmLossComputesAtBoxThirtySixA: () => {
            const result = ok(run({
                farmForms: [farmDocument({
                    entries: [entryOf('feed')('192600.00')],
                })('sha256-farm-a')],
            }))
            assertEq(result.line9.value, 14260000n, 'printed line 9, gross income')
            assertEq(result.line33.value, 19260000n, 'printed line 33, total expenses')
            assertEq(result.line34.value, -5000000n, '$50,000.00 of loss -> Schedule 1 line 6')
            const boxes = result.line34.sources.map(source => source.boxPath)
            assert(boxes.includes('salesOfRaisedProductsAndLivestock'),
                ['the receipt behind the loss', boxes])
            assert(boxes.includes('entries[category=feed]'),
                ['and the expense that created it', boxes])
        },
        /**
         * ★ **PRINTED LINE E ANSWERING "No" REFUSES A PROFIT.** The ground is
         * §1411, and without this refusal `fjs/form8960`'s line 4b could not be
         * a structural zero.
         */
        noMaterialParticipationRefusesEvenOnAProfit: () => {
            const message = refusal(run({
                farmForms: [farmDocument({ materiallyParticipated: 'no' })('sha256-farm-a')],
            }))
            assert(message.includes('line E'), ['the printed line', message])
            assert(message.includes('§1411(c)(1)(A)(ii)'), ['the statute', message])
            assert(message.includes('Form 8960 line 4a'), ['the printed line that would be short', message])
            assert(message.includes('3.8%'), ['the rate that would be escaped', message])
            assert(message.includes('UNDERSTATEMENT'), ['the direction of the error', message])
            assert(message.includes('FARM-0001'), ['which farm', message])
            // THE CONTROL: the identical farm at "yes" computes a profit.
            const yes = ok(run({
                farmForms: [farmDocument({})('sha256-farm-a')],
            }))
            assertEq(yes.line34.value, 14260000n)
        },
        /**
         * ★ **THE ACCRUAL METHOD REFUSES AT PRINTED LINE 45**, naming the
         * inventory and the two valuation methods.
         */
        theAccrualMethodRefusesAtPrintedLineFortyFive: () => {
            const message = refusal(run({
                farmForms: [farmDocument({ accountingMethod: 'accrual' })('sha256-farm-a')],
            }))
            assert(message.includes('line 45'), ['the printed line', message])
            assert(message.includes('BEGINNING of the year'), ['what line 45 asks for', message])
            assert(message.includes('line 48'), ['and its end-of-year twin', message])
            assert(message.includes('unit-livestock-price method'), ['the first valuation method', message])
            assert(message.includes('farm-price method'), ['the second', message])
            assert(message.includes('one tax year'), ['why the prior-year figure is out of reach', message])
            assert(message.includes('FARM-0001'), ['which farm', message])
            // THE CONTROL: the identical farm on the cash method computes.
            const cash = ok(run({ farmForms: [farmDocument({})('sha256-farm-a')] }))
            assertEq(cash.line34.value, 14260000n)
        },
        /** Printed line 6c, the deferral election. */
        theCropInsuranceDeferralElectionRefuses: () => {
            const message = refusal(run({
                farmForms: [farmDocument({
                    cropInsuranceProceedsReceived: '11400.00',
                    cropInsuranceProceedsTaxableAmount: '0.00',
                    electionToDeferCropInsuranceProceeds: true,
                })('sha256-farm-a')],
            }))
            assert(message.includes('line 6c'), ['the printed line', message])
            assert(message.includes('2026'), ['the year it moves income into', message])
            assert(message.includes('ALL-OR-NOTHING'), ['the printed constraint', message])
            assert(message.includes('line 6b'), ['the line that would become a partition', message])
            // THE CONTROL: the identical proceeds reported in 2025 compute.
            const reported = ok(run({
                farmForms: [farmDocument({
                    cropInsuranceProceedsReceived: '11400.00',
                    cropInsuranceProceedsTaxableAmount: '11400.00',
                })('sha256-farm-a')],
            }))
            assertEq(reported.line6b.value, 1140000n)
            assertEq(reported.line9.value, 15400000n, '$142,600.00 + $11,400.00')
        },
        /** Printed line 6d unstated. */
        anUnstatedPriorYearDeferralRefuses: () => {
            const message = refusal(run({
                farmForms: [farmDocument({
                    cropInsuranceProceedsDeferredFromPriorYear: undefined,
                })('sha256-farm-a')],
            }))
            assert(message.includes('line 6d'), ['the printed line', message])
            assert(message.includes('cropInsuranceProceedsDeferredFromPriorYear'),
                ['the field to set', message])
            assert(message.includes('UNDERSTATE'), ['the direction of the error', message])
            assert(message.includes('"0.00"'), ['what to store to say none', message])
            // THE CONTROL: "0.00" computes, and so does a real deferred amount,
            // which lands on printed line 9.
            const none = ok(run({ farmForms: [farmDocument({})('sha256-farm-a')] }))
            assertEq(none.line6d.value, 0n)
            const deferred = ok(run({
                farmForms: [farmDocument({
                    cropInsuranceProceedsDeferredFromPriorYear: '8250.00',
                })('sha256-farm-a')],
            }))
            assertEq(deferred.line6d.value, 825000n, 'line 6d $8,250.00')
            assertEq(deferred.line9.value, 15085000n, '$142,600.00 + $8,250.00')
        },
        anUnknownCategoryRefusesByName: () => {
            const message = refusal(run({
                farmForms: [farmDocument({
                    entries: [entryOf('moonBeams')('10.00')],
                })('sha256-farm-a')],
            }))
            assert(message.includes("'moonBeams'"), ['the offending value', message])
            assert(message.includes('chemicals'), ['the vocabulary', message])
            assert(message.includes('line 33'), ['what the amount would vanish from', message])
            // THE CONTROL: every one of the twenty-one COMPUTED categories is
            // accepted and lands on printed line 33, and the ACCEPTED COUNT is
            // asserted — so a category quietly dropped from the table shortens
            // this loop and fails here rather than passing unnoticed.
            let accepted = 0
            for (const row of farmExpenseLines) {
                if (refusedCategories.includes(row.category)) {
                    continue
                }
                const outcome = ok(run({
                    farmForms: [farmDocument({
                        entries: [entryOf(row.category)('1.00')],
                    })('sha256-farm-a')],
                }))
                assertEq(outcome.line33.value, 100n, row.category)
                accepted = accepted + 1
            }
            assertEq(accepted, expectedFarmExpenseLineCount - expectedRefusedCategoryCount,
                'twenty-five printed lines less the four that refuse')
        },
        /**
         * The four categories that are recognized in order to be refused, each
         * naming its own printed line and its own reason. The messages must be
         * FOUR different messages: one refusal used for all four would pass a
         * per-category assertion that only looked for the amount.
         */
        theFourRefusedCategoriesEachNameTheirOwnPrintedLineAndReason: () => {
            /** @type {readonly (readonly [string, string, readonly string[]])[]} */
            const cases = [
                ['carAndTruck', 'line 10', ['Part V', '§274(d)', '§280F']],
                ['conservationExpenses', 'line 12',
                    ['§175', "25% of your gross income", 'carried forward']],
                ['depreciationAndSection179', 'line 14',
                    ['TWICE', 'vnd.fjs.asset_register', 'sevenYear']],
                ['pensionAndProfitSharingPlans', 'line 23',
                    ['Schedule 1 (Form 1040), line 16', 'self-employment']],
            ]
            assertEq(cases.length, expectedRefusedCategoryCount)
            /** @type {string[]} */
            const messages = []
            for (const [category, printed, phrases] of cases) {
                const message = refusal(run({
                    farmForms: [farmDocument({
                        entries: [entryOf(category)('340.00')],
                    })('sha256-farm-a')],
                }))
                assert(message.includes(printed), ['the printed line', category, message])
                assert(message.includes('340.00'), ['the amount', category, message])
                assert(message.includes('FARM-0001'), ['which farm', category, message])
                for (const phrase of phrases) {
                    assert(message.includes(phrase), ['the reason', category, phrase, message])
                }
                messages.push(message)
            }
            assertEq(new Set(messages).size, expectedRefusedCategoryCount,
                'four printed lines, four reasons, four messages')
        },
        twoFarmDocumentsRefuse: () => {
            const message = refusal(run({
                farmForms: [
                    farmDocument({})('sha256-farm-a'),
                    farmDocument({
                        accountNumber: 'FARM-0002',
                        principalCropOrActivity: 'dairy cattle and milk production',
                    })('sha256-farm-b'),
                ],
            }))
            assert(message.includes('corn and soybeans'), ['the first farm', message])
            assert(message.includes('dairy cattle and milk production'), ['the second', message])
            assert(message.includes('§465'), ['what merging would defeat', message])
            // THE CONTROL: either ONE alone computes.
            const one = ok(run({ farmForms: [farmDocument({})('sha256-farm-a')] }))
            assertEq(one.line34.value, 14260000n)
        },
        aBusinessExpensesRecordBesideAFarmRefuses: () => {
            /** @type {BusinessExpenses} */
            const business = {
                dialect: 'vnd.fjs.business_expenses',
                recipientTin: '222-22-2222',
                accountNumber: 'BUS-0001',
                taxYear: 2025,
                principalBusiness: 'custom welding',
                entries: [],
            }
            const message = refusal(run({
                farmForms: [farmDocument({})('sha256-farm-a')],
                businessExpenseForms: [{ documentHash: 'sha256-business-a', value: business }],
            }))
            assert(message.includes('custom welding'), ['the business', message])
            assert(message.includes('corn and soybeans'), ['and the farm', message])
            assert(message.includes('Form 8995-A'), ['the form that cannot carry both', message])
            assert(message.includes('§461(l)'), ['and the other aggregation', message])
            // THE CONTROL: the farm ALONE computes, and so does a return with
            // the business record and no farm.
            const farmAlone = ok(run({ farmForms: [farmDocument({})('sha256-farm-a')] }))
            assertEq(farmAlone.filed, true)
            const businessAlone = ok(run({
                businessExpenseForms: [{ documentHash: 'sha256-business-a', value: business }],
            }))
            assertEq(businessAlone.filed, false, 'Schedule C is not this module’s business')
        },
        twoRegistersForOneFarmRefuse: () => {
            const message = refusal(run({
                farmForms: [farmDocument({})('sha256-farm-a')],
                assetRegisters: [
                    grainBinRegister('sha256-register-a'),
                    {
                        documentHash: 'sha256-register-b',
                        value: {
                            ...grainBinRegister('x').value,
                            businessOrActivity: 'Hollow Creek Farm machinery',
                        },
                    },
                ],
            }))
            assert(message.includes('Hollow Creek Farm'), ['the first activity', message])
            assert(message.includes('Hollow Creek Farm machinery'), ['the second', message])
            assert(message.includes('mid-quarter'), ['why merging is wrong', message])
        },
        // Form 4562's OWN refusals travel out verbatim, so a register this
        // engine cannot complete never produces a Schedule F short by the
        // depreciation.
        aFormFortyFiveSixtyTwoRefusalTravelsOutUnchanged: () => {
            const register = grainBinRegister('sha256-register-a')
            const [asset] = register.value.assets
            assert(asset !== undefined, ['expected the asset'])
            assert(asset !== undefined, ['expected the asset'])
            const message = refusal(run({
                farmForms: [farmDocument({})('sha256-farm-a')],
                assetRegisters: [{
                    documentHash: register.documentHash,
                    value: {
                        ...register.value,
                        assets: [{ ...asset, section179ElectedCost: '84000.00' }],
                    },
                }],
            }))
            assert(message.includes('Form 4562'), ['the refusal is Form 4562’s own', message])
            assert(message.includes('grain bin'), ['and it names the asset', message])
        },
        /**
         * ★ **AN ORPHAN FORM 1099-G BOX 7 OR BOX 9 REFUSES.** Without this,
         * removing `vnd.fjs.1099g`'s document-level refusal would drop farm
         * income from the return in silence.
         */
        anOrphanAgriculturePaymentRefuses: () => {
            for (const [field, printed, amount] of /** @type {readonly (readonly [string, string, string])[]} */ ([
                ['box7AgriculturePayments', 'box 7', '3400.00'],
                ['box9MarketGain', 'box 9', '1250.00'],
            ])) {
                const message = refusal(run({
                    unemploymentForms: [form1099GDocument({ [field]: amount })('sha256-1099g-a')],
                }))
                assert(message.includes(printed), ['the printed box', field, message])
                assert(message.includes(field), ['and the schema field', field, message])
                assert(message.includes(amount), ['the amount', field, message])
                assert(message.includes('sha256-1099g-a'), ['which document', field, message])
                assert(message.includes('line 4a'), ['where it would have gone', field, message])
                assert(message.includes('vnd.fjs.farm'), ['what to store', field, message])
            }
            // THE CONTROL, three ways. A farm makes the same boxes compute; a
            // ZERO box is not an orphan; and a Form 1099-G carrying only box 1
            // unemployment compensation is untouched.
            const withFarm = ok(run({
                farmForms: [farmDocument({})('sha256-farm-a')],
                unemploymentForms: [form1099GDocument({
                    box7AgriculturePayments: '3400.00',
                })('sha256-1099g-a')],
            }))
            assertEq(withFarm.line4a.value, 340000n)
            const zeroBox = ok(run({
                unemploymentForms: [form1099GDocument({
                    box7AgriculturePayments: '0.00', box9MarketGain: '0',
                })('sha256-1099g-a')],
            }))
            assertEq(zeroBox.filed, false, 'a zero box reaches no printed line either way')
            const unemploymentOnly = ok(run({
                unemploymentForms: [form1099GDocument({
                    box1UnemploymentCompensation: '4200.00',
                })('sha256-1099g-a')],
            }))
            assertEq(unemploymentOnly.filed, false)
        },
    },
}
