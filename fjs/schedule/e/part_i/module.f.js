/**
 * Schedule E (Form 1040) **Part I** — *Income or Loss From Rental Real Estate
 * and Royalties*, printed lines 1a through 26.
 *
 * Spec:
 * [../todo/schedule-e-part-i-rental-and-royalties.md](../todo/schedule-e-part-i-rental-and-royalties.md),
 * written before this file. Everything below cites the printed 2025
 * `f1040se.pdf` face or the `i1040se.pdf` instructions by page.
 *
 * ## A PROFIT computes. A LOSS refuses. The printed page is why
 *
 * Read printed lines 21, 22, 24 and 25 in order and the asymmetry is the
 * page's own, not this engine's:
 *
 * - **24.** *"Income. Add positive amounts shown on line **21**. Do not include
 *   any losses."*
 * - **25.** *"Losses. Add royalty losses from line **21** and rental real
 *   estate losses from line **22**."*
 * - **22.** *"Deductible rental real estate loss after limitation, if any, on
 *   **Form 8582**."*
 *
 * So §469 sits on printed line 22, and a PROFIT never passes through printed
 * line 22. A profitable property reaches line 26 with no Form 8582, no
 * prior-year unallowed loss and no modified adjusted gross income anywhere in
 * the arithmetic. That is why this part can ship at all.
 *
 * A rental **loss** cannot. i1040se p4's *Exception for Certain Rental Real
 * Estate Activities* — the one route that removes Form 8582 and reaches
 * §469(i)'s $25,000 special allowance — is a conjunction of six conditions, and
 * three of them are unreachable here for three different reasons:
 * *"Rental real estate activities are your only passive activities"* is a
 * statement about the whole return that a property record cannot make (this
 * engine can carry a passive Schedule E Part II row beside it); *"no prior-year
 * unallowed losses"* and *"no current or prior-year unallowed credits"* are
 * prior-year figures, this repository's standing architectural blocker, and
 * there is no printed line for an unallowed passive credit to be transcribed
 * from; and *"modified adjusted gross income … $100,000 or less"* is Pub. 925's
 * MAGI, which is adjusted gross income figured WITHOUT the very loss being
 * limited — circular with the line under computation.
 *
 * So {@link rentalLossRefusal} refuses, and printed line 25 is a STRUCTURAL
 * zero: no loss can reach it, because every loss refuses before any total is
 * formed. This is `fjs/schedule/c` line 31's decision and
 * `fjs/schedule/e`'s `beneficiaryLossRefusal`, reached the same way.
 *
 * A **royalty** loss refuses through a DIFFERENT function naming a different
 * statute, and the separation is the point rather than duplication. Printed
 * line 25 takes a royalty loss straight off line 21 — i1040se p7: *"Do not
 * complete line 22 if the amount on line 21 is from royalty properties"* — so
 * §469 never touches it. What does touch it is printed line 21's own text,
 * *"see instructions to find out if you must file **Form 6198**"*, and i1040se
 * p3: *"At-risk rules apply to losses from rental real estate **or
 * royalties**."* §465 is a multi-year amount-at-risk history. A filer who is
 * told "Form 8582" when they need Form 6198 has been told the wrong thing.
 *
 * ## §280A: three regimes, one predicate, and all three refuse
 *
 * i1040se p5, Line 2: *"You used the unit as a home if your personal use of the
 * unit was more than the greater of: 14 days, or 10% of the total days it was
 * rented to others at a fair rental price."* {@link usedAsAHome} is that
 * sentence, in exact integer arithmetic — *more than the greater of* is a
 * CONJUNCTION, since exceeding a maximum means exceeding both of its arms, and
 * writing it as `personalUseDays * 10 > fairRentalDays` keeps the 10% arm free
 * of any division that could round.
 *
 * | Regime | Condition | Verdict |
 * |---|---|---|
 * | no personal use | `personalUseDays === 0` | **COMPUTES** |
 * | §280A(e) allocation | personal use, not a home | REFUSES |
 * | §280A(c)(5) cap | a home, 15 or more fair rental days | REFUSES |
 * | §280A(g) exclusion | a home, fewer than 15 fair rental days | REFUSES |
 *
 * The cap is Pub. 527's Worksheet 5-1: three ordered tiers, each allowed only
 * down to zero of remaining gross rental income, with the disallowed remainder
 * **carried forward to next year**. That is a prior-year figure in the outbound
 * direction, so the cap cannot be computed and is not approximated.
 *
 * The bare §280A(e) allocation looks computable —
 * `fairRental / (fairRental + personal)` — and it refuses anyway, on a ground
 * that is not arithmetic: **the disallowed share of mortgage interest and real
 * estate taxes does not vanish.** It becomes a Schedule A itemized deduction,
 * and this engine has no wiring that carries it there, so computing the rental
 * side alone would produce a Schedule E that is right and a Schedule A that is
 * short. The instructions' own hedge is the second reason — *"**In most cases**,
 * 10% (7 ÷ 70) of your expenses are not rental expenses"* — because for
 * interest and taxes Bolton v. Commissioner, 694 F.2d 556 (9th Cir. 1982),
 * allocates over 365 days instead. The IRS day-count method is a position, not
 * the only one.
 *
 * A **royalty** property has no line 2 at all (i1040se p4), so §280A cannot
 * reach it, and `vnd.fjs.rental_property` refuses a royalty that carries a day
 * count.
 *
 * ## Line 18 comes from Form 4562, and from nowhere else
 *
 * `fjs/form4562`'s MACRS module already reproduces Publication 946 Table A-6 —
 * residential rental, 27.5-year, mid-month — at 114 of 114 hand-typed printed
 * cells, and `vnd.fjs.asset_register` already carries `residentialRental` and
 * `nonresidentialReal` with the mid-month convention forced by the
 * classification. So **no second depreciation path is written here.** Printed
 * line 18 is Form 4562 line 22, on the register whose `accountNumber` matches
 * the property's — the identical binding `fjs/schedule/c` makes between a
 * register and a business — and every one of Form 4562's own refusals is
 * threaded out verbatim.
 *
 * A stored `depreciationOrDepletion` ENTRY refuses, for `fjs/schedule/c` line
 * 13's reason: the figure would be counted twice. Depletion refuses with it,
 * because printed line 18 carries both and this engine models no depletion.
 *
 * ## Printed line 6 refuses, and it is the same answer Schedule C line 9 gives
 *
 * i1040se p6, Line 6: *"If you claim any auto expenses (actual or the standard
 * mileage rate), you must complete **Part V of Form 4562** and attach Form 4562
 * to your tax return."* `fjs/form4562` Part V REFUSES — §274(d) substantiation
 * and §280F's per-year caps — so a Schedule E carrying a line 6 amount is a
 * return this engine cannot complete. Refusing costs the filer a refusal;
 * computing would cost them an attachment that does not exist.
 *
 * ## Many properties, one total — the opposite of Schedule C
 *
 * `fjs/schedule/c` refuses a SECOND `vnd.fjs.business_expenses` because
 * Schedule C is filed per business. This part is the other case, and the
 * printed page says so: i1040se p2, *"If you have more than three rental real
 * estate or royalty properties, complete and attach as many Schedules E as you
 * need to list them. But fill in lines 23a through 26 on only one Schedule E."*
 * Combining is what the form asks for, and it is safe here for
 * `fjs/schedule/e` Part II's reason: **every column that could carry a loss
 * refuses before any total is formed**, so no property's loss is ever netted
 * against another's income.
 *
 * What DOES refuse is two properties sharing an `accountNumber`
 * ({@link duplicatePropertyRefusal}) — either a duplicate transcription or an
 * original and its correction, and summing them reports the rent twice.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../../../exact/module.f.js'
import { formFortyFiveSixtyTwo } from '../../../form4562/module.f.js'
import { depreciableAssets } from '../../../document/asset_register/module.f.js'

/** @import { ReturnProfile } from '../../../return/profile/module.f.js' */
/** @import { RentalProperty } from '../../../document/rental_property/module.f.js' */
/** @import { AssetRegister } from '../../../document/asset_register/module.f.js' */
/** @import { Form4562Lines } from '../../../form4562/module.f.js' */
/** @import { ReportLine, Source } from '../../../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/e`'s own
 * `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * A case this part will not compute — the same shape `fjs/schedule/e`,
 * `fjs/schedule/c` and `fjs/form4562` already return, so a caller threads it
 * through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleEPartIRefusal
 */

/**
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 * }} ScheduleEPartIInput
 */

// ── The printed expense vocabulary ───────────────────────────────────────────

/**
 * Printed lines 5 through 19, one row each, in printed order: the `category`
 * a `vnd.fjs.rental_property` entry may carry, the printed line it reaches, and
 * the printed label a report prints beside it.
 *
 * **Line 18 is in this table even though no entry may claim it**, and that is
 * deliberate: {@link refusedCategories} names it, so a stored entry is refused
 * by name rather than silently ignored — `fjs/schedule/c`'s
 * `depreciationAndSection179` idiom, for the same reason. The printed line
 * still exists and still carries a figure; the figure comes from Form 4562.
 *
 * The vocabulary lives HERE and not on the dialect for the reason
 * `vnd.fjs.business_expenses` keeps `category` a free string: deciding which
 * printed line an expense reaches is deduction logic, and this module is that
 * logic.
 * @type {readonly { readonly category: string, readonly printedLine: number, readonly label: string }[]}
 */
export const rentalExpenseLines = [
    { category: 'advertising', printedLine: 5, label: 'advertising' },
    { category: 'autoAndTravel', printedLine: 6, label: 'auto and travel' },
    { category: 'cleaningAndMaintenance', printedLine: 7, label: 'cleaning and maintenance' },
    { category: 'commissions', printedLine: 8, label: 'commissions' },
    { category: 'insurance', printedLine: 9, label: 'insurance' },
    { category: 'legalAndOtherProfessionalFees', printedLine: 10, label: 'legal and other professional fees' },
    { category: 'managementFees', printedLine: 11, label: 'management fees' },
    { category: 'mortgageInterestPaidToBanks', printedLine: 12, label: 'mortgage interest paid to banks, etc.' },
    { category: 'otherInterest', printedLine: 13, label: 'other interest' },
    { category: 'repairs', printedLine: 14, label: 'repairs' },
    { category: 'supplies', printedLine: 15, label: 'supplies' },
    { category: 'taxes', printedLine: 16, label: 'taxes' },
    { category: 'utilities', printedLine: 17, label: 'utilities' },
    { category: 'depreciationOrDepletion', printedLine: 18, label: 'depreciation expense or depletion' },
    { category: 'other', printedLine: 19, label: 'other' },
]

/**
 * Independently HAND-COUNTED off the printed face: lines 5 through 19 inclusive
 * is fifteen rows. Deliberately NOT `rentalExpenseLines.length` — a row
 * silently dropped from the table above would otherwise still pass every loop
 * that iterates it (AGENTS.md's fourth shipped defect).
 * @type {number}
 */
export const expectedRentalExpenseLineCount = 15

/**
 * The two categories that are RECOGNIZED in order to be refused, in printed
 * order. Each has its own refusal function naming its own reason; this list is
 * only the order they are checked in.
 * @type {readonly string[]}
 */
export const refusedCategories = ['autoAndTravel', 'depreciationOrDepletion']

// ── Local helpers (reimplemented, not imported from `fjs/schedule/e`) ─────────
//
// `fjs/schedule/e` imports THIS module, so importing its helpers back would be
// a cycle. They are reimplemented here under this tree's standing
// "reimplement an idiom you cannot import" precedent — the same note
// `fjs/schedule/e` itself carries above its own copies.

/**
 * A line that is zero because the taxpayer stored no such property.
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

// ── §280A ────────────────────────────────────────────────────────────────────

/** §280A(d)(1)'s bare-day arm: *"more than … 14 days"*. @type {number} */
export const personalUseDayThreshold = 14

/**
 * §280A(d)(1)'s percentage arm, as a whole-number divisor rather than a
 * fraction: *"10% of the total days it was rented to others at a fair rental
 * price"*. Compared as `personalUseDays * 10 > fairRentalDays`, so nothing
 * divides and nothing rounds.
 * @type {bigint}
 */
export const personalUsePercentageArm = 10n

/**
 * §280A(d)(1), i1040se p5: *"You used the unit as a home if your personal use
 * of the unit was more than the greater of: • 14 days, or • 10% of the total
 * days it was rented to others at a fair rental price."*
 *
 * **"More than the greater of" is a CONJUNCTION.** Exceeding a maximum means
 * exceeding both arms, so a taxpayer with 20 personal days against 365 fair
 * rental days did NOT use the unit as a home (20 > 14, but 20 × 10 = 200 is not
 * more than 365), while one with 20 personal days against 100 fair rental days
 * did (20 × 10 = 200 > 100). Reading it as a disjunction would move the first
 * filer into §280A(c)(5).
 * @type {(fairRentalDays: number) => (personalUseDays: number) => boolean}
 */
export const usedAsAHome = fairRentalDays => personalUseDays =>
    personalUseDays > personalUseDayThreshold
    && BigInt(personalUseDays) * personalUsePercentageArm > BigInt(fairRentalDays)

/**
 * §280A(g), i1040se p5: *"If you did use the unit as a home and rented the unit
 * out for fewer than 15 days in 2025, do not report the rental income and do
 * not deduct any rental expenses."* Fifteen, so `< 15` is the test and 14 is
 * inside it.
 * @type {number}
 */
export const deMinimisRentalDayThreshold = 15

// ── Refusals ─────────────────────────────────────────────────────────────────

/**
 * The property a refusal names: its printed line 1b type and its
 * `accountNumber`, since the address is optional on the page and absent
 * entirely on a royalty.
 * @type {(property: RentalProperty) => string}
 */
const propertyLabel = property => property.physicalAddress === undefined
    ? `'${property.accountNumber}' (${property.propertyType})`
    : `'${property.accountNumber}' (${property.propertyType}, ${property.physicalAddress})`

/**
 * Two `vnd.fjs.rental_property` documents with the same `accountNumber` — a
 * duplicate transcription, or an original and its correction. `corrected` is
 * stored on the dialect and read by nothing, so this module cannot tell the
 * pair apart, and summing them reports the rent twice.
 * @type {(accountNumber: string) => ScheduleEPartIRefusal}
 */
export const duplicatePropertyRefusal = accountNumber => ({
    kind: 'error',
    message: `Schedule E Part I: two vnd.fjs.rental_property documents carry accountNumber `
        + `'${accountNumber}'. Printed lines 1a-2 describe ONE property per column and lines 23a-26 `
        + `combine the columns, so two records for one property would report its rents twice on `
        + `printed line 3 and its expenses twice on line 20. They are either a duplicate `
        + `transcription or an original and its correction, and the stored 'corrected' flag is not `
        + `read by anything here, so this engine cannot choose between them. Remove one`,
})

/**
 * A `category` no printed line names. Refused by name, quoting the value and
 * the property, exactly as `fjs/schedule/c` refuses an unknown Schedule C
 * category.
 * @type {(property: RentalProperty) => (category: string) => (description: string) => ScheduleEPartIRefusal}
 */
export const unknownCategoryRefusal = property => category => description => ({
    kind: 'error',
    message: `Schedule E Part I: the vnd.fjs.rental_property for ${propertyLabel(property)} carries `
        + `an expense in category '${category}' (${description}), and printed Part I has no line `
        + `for it. Lines 5 through 19 are the whole of the expense block — `
        + `${rentalExpenseLines.map(row => row.category).join(', ')} — and an amount this engine `
        + `cannot place would either vanish from printed line 20 or land on a line the taxpayer `
        + `did not choose. Re-file it under a printed category`,
})

/**
 * Printed line 6, *"Auto and travel"*. i1040se p6 requires Form 4562 Part V for
 * any auto expense, and `fjs/form4562` Part V refuses.
 * @type {(property: RentalProperty) => (amount: string) => ScheduleEPartIRefusal}
 */
export const autoAndTravelRefusal = property => amount => ({
    kind: 'error',
    message: `Schedule E Part I line 6 (auto and travel) for ${propertyLabel(property)} carries `
        + `${amount}, and this engine refuses it. i1040se p6: "If you claim any auto expenses `
        + `(actual or the standard mileage rate), you must complete Part V of Form 4562 and attach `
        + `Form 4562 to your tax return." A vehicle is LISTED PROPERTY, and fjs/form4562 refuses `
        + `Part V by name — line 24a asks whether there is evidence to support the business use `
        + `claimed and 24b whether that evidence is written, which is §274(d) substantiation no `
        + `document here carries, and §280F caps a passenger automobile's depreciation besides. `
        + `Schedule C line 9 gives the same answer for the same reason (no phase yet)`,
})

/**
 * Printed line 18, *"Depreciation expense or depletion"*, as a stored ENTRY.
 * The line is COMPUTED from a `vnd.fjs.asset_register`, so an entry would
 * double it. Depletion refuses with it.
 * @type {(property: RentalProperty) => (amount: string) => ScheduleEPartIRefusal}
 */
export const depreciationEntryRefusal = property => amount => ({
    kind: 'error',
    message: `Schedule E Part I line 18 (depreciation expense or depletion) for `
        + `${propertyLabel(property)} carries a stored entry of ${amount}, and this line is `
        + `COMPUTED rather than transcribed: it is Form 4562 line 22, off the vnd.fjs.asset_register `
        + `whose accountNumber matches this property's. Accepting the entry as well would deduct `
        + `the depreciation TWICE, once from the register and once from the entry. DEPLETION shares `
        + `the printed line and is refused with it — i1040se p7 puts an economic interest in mineral `
        + `property here, and this engine computes no depletion at all. Store a `
        + `vnd.fjs.asset_register for this property instead`,
})

/**
 * Printed type code **7, self-rental**. i1040se p5, Line 1b: *"Enter code 7
 * for self-rental if you rent property to a trade or business in which you
 * materially participated."*
 *
 * The code is therefore not a description — it is an ASSERTION of material
 * participation in the tenant's trade or business, and two rules turn on it in
 * opposite directions from every other column on this page:
 *
 * - Temp. Reg. §1.469-2(f)(6) recharacterizes NET RENTAL INCOME from a
 *   self-rental as NON-passive, while a net loss stays passive. So a
 *   self-rental is the one Part I column whose §469 character depends on the
 *   sign of its own line 21.
 * - Reg. §1.1411-4(g)(6) then removes that income from net investment income,
 *   which is printed Form 8960 line 4b — the adjustment `fjs/form8960` carries
 *   as a STRUCTURAL zero precisely because this refusal exists. Wiring line 4a
 *   without this refusal would tax a self-rental's income at 3.8% under §1411
 *   when the regulation exempts it.
 * @type {(property: RentalProperty) => ScheduleEPartIRefusal}
 */
export const selfRentalRefusal = property => ({
    kind: 'error',
    message: `Schedule E Part I: the property ${propertyLabel(property)} is printed type code 7, `
        + `SELF-RENTAL, and this engine refuses it. i1040se p5 defines that code as renting "to a `
        + `trade or business in which you materially participated", so the code itself asserts `
        + `material participation — and two rules then treat this column unlike every other one on `
        + `the page. Temp. Reg. §1.469-2(f)(6) recharacterizes net rental INCOME from a `
        + `self-rental as NON-passive while leaving a net loss passive, so its §469 character `
        + `depends on the sign of its own line 21; and Reg. §1.1411-4(g)(6) then removes that `
        + `income from net investment income, which is printed Form 8960 line 4b. This engine `
        + `computes line 4a from printed line 26 and carries line 4b as a zero, so admitting a `
        + `self-rental would charge 3.8% under §1411 on income the regulation exempts. Refusing `
        + `rather than taxing it (Form 8960 line 4b, no phase yet)`,
})

/**
 * §280A, all three regimes. ONE function, because all three read the same two
 * printed day counts and the message must say WHICH regime fired — a filer in
 * the allocation case and a filer in the exclusion case need different next
 * steps.
 * @type {(property: RentalProperty) => (fairRentalDays: number) => (personalUseDays: number) => ScheduleEPartIRefusal}
 */
export const personalUseRefusal = property => fairRentalDays => personalUseDays => {
    const home = usedAsAHome(fairRentalDays)(personalUseDays)
    const regime = !home
        ? `§280A(e) — you did NOT use the unit as a home (${personalUseDays} personal days is not `
            + `more than the greater of ${personalUseDayThreshold} days and 10% of `
            + `${fairRentalDays} fair rental days), so every expense is deductible in principle `
            + `but only the RENTAL share of it. i1040se p5: "Regardless of whether you used the `
            + `unit as a home, expenses related to days of personal use do not qualify as rental `
            + `expenses. You must allocate your expenses based on the number of days of personal `
            + `use to total use of the property"`
        : fairRentalDays < deMinimisRentalDayThreshold
            ? `§280A(g) — you used the unit as a home and rented it for ${fairRentalDays} days, `
                + `fewer than ${deMinimisRentalDayThreshold}. i1040se p5: "do not report the rental `
                + `income and do not deduct any rental expenses". The property does not belong on `
                + `printed Part I at all, and the interest and taxes belong on Schedule A`
            : `§280A(c)(5) — you used the unit as a home (${personalUseDays} personal days is more `
                + `than the greater of ${personalUseDayThreshold} days and 10% of `
                + `${fairRentalDays} fair rental days) and rented it for `
                + `${deMinimisRentalDayThreshold} days or more, so your deductions are CAPPED at `
                + `the gross rental income. i1040se p5: "you may not be able to deduct all your `
                + `rental expenses. See Pub. 527"`
    return {
        kind: 'error',
        message: `Schedule E Part I: the property ${propertyLabel(property)} reports `
            + `${personalUseDays} personal use days on printed line 2, and this engine refuses it. `
            + `${regime}. The cap itself is Publication 527's Worksheet 5-1 — three ordered tiers, `
            + `each allowed only down to zero of the remaining gross rental income, with the `
            + `disallowed remainder CARRIED FORWARD to next year, which is a prior-year figure in `
            + `the outbound direction. And the day-count allocation alone is refused even where the `
            + `cap does not apply, because the disallowed share of the mortgage interest and the `
            + `real estate taxes does not vanish: it becomes a Schedule A itemized deduction, and `
            + `nothing here carries it there, so this engine would compute a Schedule E that is `
            + `right and a Schedule A that is short. The instructions hedge too — "In most cases, `
            + `10% (7 / 70) of your expenses" — because Bolton v. Commissioner, 694 F.2d 556 (9th `
            + `Cir. 1982), allocates interest and taxes over 365 days instead. A property with ZERO `
            + `personal use days computes (no phase yet)`,
    }
}

/**
 * Printed line 21 is a LOSS on a RENTAL property. §469, and the three
 * conditions of i1040se p4's exception that this engine cannot satisfy.
 * @type {(property: RentalProperty) => (lossCents: bigint) => ScheduleEPartIRefusal}
 */
export const rentalLossRefusal = property => lossCents => ({
    kind: 'error',
    message: `Schedule E Part I line 21 for ${propertyLabel(property)} is a LOSS of `
        + `${centsToString(-lossCents)}, and this engine refuses it. Printed line 24 adds only the `
        + `POSITIVE amounts on line 21; a rental loss reaches printed line 25 through line 22, `
        + `"Deductible rental real estate loss after limitation, if any, on Form 8582". §469 makes `
        + `a rental activity passive whatever the taxpayer's involvement, and Form 8582 needs EVERY `
        + `passive activity on the return plus every prior-year unallowed loss. i1040se p4's `
        + `exception is the only route that removes it and reaches §469(i)'s $25,000 special `
        + `allowance, and three of its six conditions are out of reach here: rental real estate `
        + `must be your ONLY passive activity (this return can carry a passive Schedule E Part II `
        + `row beside it), you must have NO prior-year unallowed passive losses and no current or `
        + `prior-year unallowed passive credits (prior-year figures, which this engine holds only `
        + `where a printed line exists to transcribe them — and none does), and your modified `
        + `adjusted gross income must be $100,000 or less (Pub. 925 figures that MAGI WITHOUT the `
        + `passive loss itself, which is circular with this very line). §465 stands behind §469 `
        + `besides: printed line 21 says "if result is a (loss), see instructions to find out if `
        + `you must file Form 6198". So the arithmetic loss is an UPPER BOUND on the deductible `
        + `loss, never the deductible loss, and letting it reach Schedule 1 line 5 would understate `
        + `the tax while moving adjusted gross income and every figure that depends on it. A `
        + `PROFIT computes; a loss refuses (Form 8582, no phase yet)`,
})

/**
 * Printed line 21 is a LOSS on a ROYALTY property. A DIFFERENT statute and a
 * different form: printed line 25 takes a royalty loss straight off line 21, so
 * §469 never touches it, and what remains is §465.
 * @type {(property: RentalProperty) => (lossCents: bigint) => ScheduleEPartIRefusal}
 */
export const royaltyLossRefusal = property => lossCents => ({
    kind: 'error',
    message: `Schedule E Part I line 21 for ${propertyLabel(property)} is a royalty LOSS of `
        + `${centsToString(-lossCents)}, and this engine refuses it. It is NOT the §469 refusal a `
        + `rental loss gets — i1040se p7 says "Do not complete line 22 if the amount on line 21 is `
        + `from royalty properties", and i1040se p4 says royalty income not derived in the ordinary `
        + `course of a trade or business is in most cases not passive, so Form 8582 is not the `
        + `blocker. §465 is: printed line 21 itself says "if result is a (loss), see instructions to `
        + `find out if you must file Form 6198", and i1040se p3 says the at-risk rules "apply to `
        + `losses from rental real estate OR ROYALTIES". The amount you are at risk for is a `
        + `multi-year history of contributions, borrowings and prior deductions that no document `
        + `here carries — the same shape §704(d) has on a Schedule K-1. A royalty PROFIT computes; `
        + `a royalty loss refuses (Form 6198, no phase yet)`,
})

/**
 * Two `vnd.fjs.asset_register` documents matching ONE property. i4562 p1 files
 * a separate Form 4562 per business or activity, and the mid-quarter convention
 * is decided by an aggregate over ONE Form 4562's own additions, so merging two
 * would pick a convention neither is on.
 * @type {(property: RentalProperty) => (first: string) => (second: string) => ScheduleEPartIRefusal}
 */
export const twoRegistersForOnePropertyRefusal = property => first => second => ({
    kind: 'error',
    message: `Schedule E Part I line 18: two vnd.fjs.asset_register documents — '${first}' and `
        + `'${second}' — carry the accountNumber of the property ${propertyLabel(property)}. A `
        + `separate Form 4562 is filed for each business or activity (i4562 p1), and the `
        + `mid-quarter convention is decided by an aggregate over ONE Form 4562's own additions, so `
        + `merging two registers would pick a convention neither activity is on. This engine `
        + `computes one register per property`,
})

// ── One printed column ───────────────────────────────────────────────────────

/**
 * ONE printed Part I column — properties A, B and C on the page, and as many
 * more as the filer attaches.
 *
 * Every printed expense line is a NAMED field rather than a list, so a mutation
 * that drops one from printed line 20's sum reddens instead of shortening a
 * loop nobody counted. `line18` is the one that does not come from `entries`.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly accountNumber: string,
 *   readonly propertyType: string,
 *   readonly royalty: boolean,
 *   readonly line3: ReportLine, readonly line4: ReportLine,
 *   readonly line5: ReportLine, readonly line6: ReportLine, readonly line7: ReportLine,
 *   readonly line8: ReportLine, readonly line9: ReportLine, readonly line10: ReportLine,
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: ReportLine, readonly line15: ReportLine, readonly line16: ReportLine,
 *   readonly line17: ReportLine, readonly line18: ReportLine, readonly line19: ReportLine,
 *   readonly line20: ReportLine, readonly line21: ReportLine,
 *   readonly form4562: Form4562Lines | undefined,
 * }} ScheduleEPartIColumn
 */

/** @typedef {{ readonly kind: 'ok', readonly column: ScheduleEPartIColumn } | ScheduleEPartIRefusal} ScheduleEPartIColumnOutcome */

/**
 * The whole of one column, printed lines 3 through 21, and every refusal that
 * belongs to one property.
 *
 * The check order is stated here because it is the order a filer meets the
 * refusals in, and it is deliberate: the record's own SHAPE first (a category
 * no line names, then the two categories that name a line this engine cannot
 * complete), then §280A, which decides whether the expenses are deductible at
 * all, then the register, then the arithmetic, and the LOSS last — because a
 * loss refusal quotes a figure that only exists once every line above it has
 * been built.
 * @type {(profile: Stored<ReturnProfile>) => (registers: readonly Stored<AssetRegister>[]) => (document: Stored<RentalProperty>) => ScheduleEPartIColumnOutcome}
 */
export const scheduleEPartIColumn = profile => registers => document => {
    const property = document.value
    const royalty = property.propertyType === 'royalties'
    for (const entry of property.entries) {
        if (!rentalExpenseLines.some(row => row.category === entry.category)) {
            return unknownCategoryRefusal(property)(entry.category)(entry.description)
        }
    }
    for (const category of refusedCategories) {
        const entry = property.entries.find(candidate => candidate.category === category)
        if (entry === undefined) {
            continue
        }
        return category === 'autoAndTravel'
            ? autoAndTravelRefusal(property)(entry.amount)
            : depreciationEntryRefusal(property)(entry.amount)
    }
    // Printed type code 7 BEFORE §280A, because a self-rental is refused
    // whatever its day counts say and a filer told about §280A first would fix
    // the wrong thing.
    if (property.propertyType === 'selfRental') {
        return selfRentalRefusal(property)
    }
    // §280A. A royalty has no printed line 2 at all, and the dialect refuses a
    // royalty that carries one, so this whole block is rental-only.
    const fairRentalDays = property.fairRentalDays
    const personalUseDays = property.personalUseDays
    if (fairRentalDays !== undefined && personalUseDays !== undefined && personalUseDays > 0) {
        return personalUseRefusal(property)(fairRentalDays)(personalUseDays)
    }
    // Printed line 18. The register whose accountNumber matches THIS property.
    const matching = registers.filter(
        register => register.value.accountNumber === property.accountNumber)
    const [firstRegister, secondRegister] = matching
    if (firstRegister !== undefined && secondRegister !== undefined) {
        return twoRegistersForOnePropertyRefusal(property)(
            firstRegister.value.businessOrActivity)(secondRegister.value.businessOrActivity)
    }
    const line18Rule = 'Schedule E line 18 (depreciation expense or depletion)'
    /** @type {Form4562Lines | undefined} */
    let form4562 = undefined
    /** @type {ReportLine} */
    let line18 = profileDeclaredZeroLine(profile)(line18Rule)
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
        line18 = documentLine(profile)(line18Rule)(outcome.line22)([{
            documentHash: firstRegister.documentHash,
            boxPath: 'assets -> Form 4562 line 22',
            value: centsToString(outcome.line22),
        }])
    }
    /** The exact cents of every entry in ONE printed category, with one source each.
     * @type {(category: string) => ReportLine}
     */
    const expenseLine = category => {
        const row = rentalExpenseLines.find(candidate => candidate.category === category)
        assert(row !== undefined, ['every expense line has a printed row', category])
        const sources = property.entries
            .filter(entry => entry.category === category)
            .map(entry => ({
                documentHash: document.documentHash,
                boxPath: `entries[category=${category}]`,
                value: entry.amount,
            }))
        const value = sources.reduce((total, source) => total + centsFromString(source.value), 0n)
        return documentLine(profile)(`Schedule E line ${row.printedLine} (${row.label})`)(value)(sources)
    }
    /** Printed line 3 or line 4's own reading. @type {(field: string | undefined) => (printedLine: number) => (label: string) => ReportLine} */
    const receiptLine = field => printedLine => label => documentLine(profile)(
        `Schedule E line ${printedLine} (${label})`)(
        field === undefined ? 0n : centsFromString(field))(
        field === undefined ? [] : [{
            documentHash: document.documentHash,
            boxPath: printedLine === 3 ? 'rentsReceived' : 'royaltiesReceived',
            value: field,
        }])
    const line3 = receiptLine(property.rentsReceived)(3)('rents received')
    const line4 = receiptLine(property.royaltiesReceived)(4)('royalties received')
    const line5 = expenseLine('advertising')
    const line6 = expenseLine('autoAndTravel')
    const line7 = expenseLine('cleaningAndMaintenance')
    const line8 = expenseLine('commissions')
    const line9 = expenseLine('insurance')
    const line10 = expenseLine('legalAndOtherProfessionalFees')
    const line11 = expenseLine('managementFees')
    const line12 = expenseLine('mortgageInterestPaidToBanks')
    const line13 = expenseLine('otherInterest')
    const line14 = expenseLine('repairs')
    const line15 = expenseLine('supplies')
    const line16 = expenseLine('taxes')
    const line17 = expenseLine('utilities')
    const line19 = expenseLine('other')
    // 20. "Total expenses. Add lines 5 through 19."
    const line20 = totalLine('Schedule E line 20 (total expenses)')([
        line5, line6, line7, line8, line9, line10, line11, line12, line13,
        line14, line15, line16, line17, line18, line19,
    ])
    // 21. "Subtract line 20 from line 3 (rents) and/or 4 (royalties)."
    const line21 = {
        value: line3.value + line4.value - line20.value,
        sources: unionSources([line3, line4, line20]),
        rule: 'Schedule E line 21 (rents or royalties received less total expenses)',
    }
    if (line21.value < 0n) {
        return royalty
            ? royaltyLossRefusal(property)(line21.value)
            : rentalLossRefusal(property)(line21.value)
    }
    return {
        kind: 'ok',
        column: {
            documentHash: document.documentHash,
            accountNumber: property.accountNumber,
            propertyType: property.propertyType,
            royalty,
            line3, line4,
            line5, line6, line7, line8, line9, line10, line11, line12, line13,
            line14, line15, line16, line17, line18, line19,
            line20, line21,
            form4562,
        },
    }
}

// ── The whole part ───────────────────────────────────────────────────────────

/**
 * Printed Part I, complete.
 *
 * `alternativeMinimumTaxAdjustmentCents` is the SUM of every column's Form 4562
 * §56(a)(1) adjustment, and it is carried out of here because
 * `fjs/schedule/c`'s Form 4562 is otherwise the only route by which an asset
 * register reaches Form 6251 line 2l. A landlord's register would silently
 * contribute nothing to the alternative minimum tax without it. It is a summed
 * `bigint` rather than a list of Form 4562s for the reason `fjs/schedule/c`
 * gives at its own `amtDepreciationAdjustmentOf`: there must be exactly ONE
 * place that reads it, so two executions cannot disagree.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly columns: readonly ScheduleEPartIColumn[],
 *   readonly line23a: ReportLine, readonly line23b: ReportLine,
 *   readonly line23c: ReportLine, readonly line23d: ReportLine,
 *   readonly line23e: ReportLine,
 *   readonly line24: ReportLine, readonly line25: ReportLine, readonly line26: ReportLine,
 *   readonly alternativeMinimumTaxAdjustmentCents: bigint,
 * }} ScheduleEPartI
 */

/** @typedef {ScheduleEPartI | ScheduleEPartIRefusal} ScheduleEPartIOutcome */

/**
 * Printed Part I, lines 1a through 26, for every stored
 * `vnd.fjs.rental_property`.
 *
 * A return with NO rental property is not a refusal: it is a Part I of
 * documented zeros, so `fjs/schedule/e`'s line 41 still carries provenance
 * (PROV-01) and a return that never had a rental computes exactly what it
 * computed before this part existed.
 * @type {(input: ScheduleEPartIInput) => ScheduleEPartIOutcome}
 */
export const scheduleEPartI = input => {
    const { profile, rentalProperties, assetRegisters } = input
    // Duplicates FIRST, before any column is built, so the doubled rent never
    // exists — `fjs/schedule/e`'s own duplicate-entity ordering.
    for (const [index, document] of rentalProperties.entries()) {
        const duplicate = rentalProperties.findIndex(
            candidate => candidate.value.accountNumber === document.value.accountNumber)
        if (duplicate !== index) {
            return duplicatePropertyRefusal(document.value.accountNumber)
        }
    }
    /** @type {ScheduleEPartIColumn[]} */
    const columns = []
    for (const document of rentalProperties) {
        const outcome = scheduleEPartIColumn(profile)(assetRegisters)(document)
        if (outcome.kind === 'error') {
            return outcome
        }
        columns.push(outcome.column)
    }
    const zero = profileDeclaredZeroLine(profile)
    /** Sums one printed line across every column, or the profile-cited zero when there are none.
     * @type {(rule: string) => (pick: (column: ScheduleEPartIColumn) => ReportLine) => ReportLine}
     */
    const across = rule => pick => columns.length === 0
        ? zero(rule)
        : totalLine(rule)(columns.map(pick))
    // 23a-23e. The five printed cross-property totals. Each names the printed
    // line it totals, because that is what the page prints beside it.
    const line23a = across('Schedule E line 23a (total of line 3 for all rental properties)')(
        column => column.line3)
    const line23b = across('Schedule E line 23b (total of line 4 for all royalty properties)')(
        column => column.line4)
    const line23c = across('Schedule E line 23c (total of line 12 for all properties)')(
        column => column.line12)
    const line23d = across('Schedule E line 23d (total of line 18 for all properties)')(
        column => column.line18)
    const line23e = across('Schedule E line 23e (total of line 20 for all properties)')(
        column => column.line20)
    // 24. "Income. Add positive amounts shown on line 21. Do not include any
    //     losses." The filter is written even though every negative column has
    //     already refused: it is the printed instruction, and a `filter` that
    //     is currently a no-op is cheaper than a line that silently stops
    //     matching the page the day the loss refusal is lifted.
    const positiveColumns = columns.filter(column => column.line21.value > 0n)
    const line24 = positiveColumns.length === 0
        ? zero('Schedule E line 24 (income: add positive amounts shown on line 21)')
        : totalLine('Schedule E line 24 (income: add positive amounts shown on line 21)')(
            positiveColumns.map(column => column.line21))
    // 25. "Losses. Add royalty losses from line 21 and rental real estate
    //     losses from line 22." A STRUCTURAL zero: every loss refuses at
    //     {@link rentalLossRefusal} or {@link royaltyLossRefusal} before this
    //     line is built, so nothing can reach it. Not a silent zero -- a zero
    //     with a refusal standing in front of it.
    //
    //     **EQUIVALENT MUTANT, recorded rather than worked around.** Deleting
    //     `line25` from line 26's sum below cannot turn red at ANY input,
    //     because the two refusals above make its value permanently zero --
    //     AGENTS.md's "a mutation a neighbouring operation absorbs", where the
    //     neighbour is a refusal rather than a `min`. It was written, run, and
    //     left the whole suite green.
    //
    //     **The provenance does not rescue it either, and the first attempt to
    //     make it bite was wrong.** A source assertion looked like the
    //     observable -- line 25 is the only summand that CITES the profile --
    //     but every column leaves one of printed lines 3 and 4 empty (a rental
    //     has no royalties and a royalty has no rents), so `documentLine`'s
    //     fallback has already put the profile's `declaredKinds` citation into
    //     line 24's own union. Measured: the mutation stayed green with the
    //     assertion in place.
    //
    //     So the sum is proven through its MIRROR IMAGE instead: dropping line
    //     24 reddens TWELVE leaves, which is what says `totalLine` over these
    //     two is load-bearing. Line 25 stays a summand because the printed
    //     instruction says "combine lines 24 and 25" and the day the loss
    //     refusal is lifted this line already carries it.
    const line25 = zero('Schedule E line 25 (losses: royalty losses from line 21 and rental losses from line 22)')
    // 26. "Total rental real estate and royalty income or (loss). Combine
    //     lines 24 and 25." THE DESTINATION: Schedule E line 41 -> Schedule 1
    //     line 5 -> 1040 line 8.
    const line26 = totalLine(
        'Schedule E line 26 (total rental real estate and royalty income or loss)')([line24, line25])
    return {
        kind: 'ok',
        columns,
        line23a, line23b, line23c, line23d, line23e,
        line24, line25, line26,
        alternativeMinimumTaxAdjustmentCents: columns.reduce(
            (total, column) => total + (column.form4562 === undefined
                ? 0n
                : column.form4562.alternativeMinimumTaxAdjustmentCents), 0n),
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: ['rentalRealEstateAndRoyalties'],
}

/** @type {Stored<ReturnProfile>} */
const profileDocument = { documentHash: 'sha256-profile', value: minimalProfileValue }

/**
 * A single-family residence let all year with no personal use, $24,000.00 of
 * rent and no expenses at all. The BASE every fixture below varies from.
 * @type {(overrides: Partial<RentalProperty>) => (documentHash: string) => Stored<RentalProperty>}
 */
const propertyDocument = overrides => documentHash => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.rental_property',
        recipientTin: '222-22-2222',
        accountNumber: 'RENT-0001',
        taxYear: 2025,
        propertyType: 'singleFamilyResidence',
        physicalAddress: '18 Alder Street, Wells, ME 04090',
        fairRentalDays: 365,
        personalUseDays: 0,
        rentsReceived: '24000.00',
        entries: [],
        ...overrides,
    },
})

/** @type {(category: string) => (amount: string) => RentalProperty['entries'][number]} */
const entryOf = category => amount => ({
    category,
    datePaid: '2025-04-15',
    description: `${category} for the year`,
    amount,
})

/** @type {(input: Partial<ScheduleEPartIInput>) => ScheduleEPartIOutcome} */
const run = input => scheduleEPartI({
    profile: profileDocument,
    rentalProperties: [],
    assetRegisters: [],
    ...input,
})

/** @type {(outcome: ScheduleEPartIOutcome) => ScheduleEPartI} */
const ok = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Part I', outcome])
    return outcome
}

/** @type {(outcome: ScheduleEPartIOutcome) => string} */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome.message
}

/**
 * A residential rental building placed in service in **March 2025**, basis
 * $275,000.00, 100% business use, straight line, mid-month.
 *
 * Table A-6 (Publication 946), 27.5-year residential rental, year 1, month 3:
 * **2.879%**. Hand-typed from the printed table, never from this engine:
 * $275,000.00 x 2.879% = **$7,917.25**.
 * @type {(documentHash: string) => Stored<AssetRegister>}
 */
const buildingRegister = documentHash => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.asset_register',
        recipientTin: '222-22-2222',
        accountNumber: 'RENT-0001',
        taxYear: 2025,
        businessOrActivity: '18 Alder Street rental',
        everyDepreciableAssetIsListed: true,
        noDepreciablePropertyDisposedOfDuringTheYear: true,
        priorYearSection179CarryoverIsZero: true,
        assets: [{
            description: 'residential rental building',
            datePlacedInService: '2025-03',
            costOrOtherBasis: '275000.00',
            businessUsePercentage: '100.00',
            classification: 'residentialRental',
            method: 'SL',
            convention: 'MM',
            section168kStatus: 'notQualifiedProperty',
        }],
    },
})

export const proof = {
    // The printed expense block, counted off the page rather than off the
    // table: lines 5 through 19 inclusive.
    theExpenseBlockIsFifteenPrintedLines: () => {
        assertEq(rentalExpenseLines.length, expectedRentalExpenseLineCount)
        assertEq(new Set(rentalExpenseLines.map(row => row.category)).size, expectedRentalExpenseLineCount)
        assertEq(new Set(rentalExpenseLines.map(row => row.printedLine)).size, expectedRentalExpenseLineCount)
        // Hand-typed off the printed face, first and last and the three the
        // totals on lines 23c-23d name.
        /** @type {(category: string) => number} */
        const lineOf = category => {
            const row = rentalExpenseLines.find(candidate => candidate.category === category)
            assert(row !== undefined, ['expected the row', category])
            assert(row !== undefined, ['expected the row', category])
            return row.printedLine
        }
        assertEq(lineOf('advertising'), 5)
        assertEq(lineOf('autoAndTravel'), 6)
        assertEq(lineOf('mortgageInterestPaidToBanks'), 12)
        assertEq(lineOf('depreciationOrDepletion'), 18)
        assertEq(lineOf('other'), 19)
        // The printed lines are 5..19 with no gap.
        assertEq(Math.min(...rentalExpenseLines.map(row => row.printedLine)), 5)
        assertEq(Math.max(...rentalExpenseLines.map(row => row.printedLine)), 19)
        assertEq(refusedCategories.length, 2)
    },
    // ── §280A(d)(1), at its own boundaries ───────────────────────────────────
    //
    // Every expectation hand-derived from i1040se p5's sentence, never from
    // this module: "more than the GREATER of 14 days, or 10% of the total days
    // it was rented to others at a fair rental price."
    usedAsAHomeIsAConjunctionAndItsBoundariesAreExact: () => {
        /** @type {readonly (readonly [number, number, boolean, string])[]} */
        const cases = [
            // fair rental, personal, expected, why
            [365, 0, false, 'no personal use at all'],
            [365, 14, false, '14 is not MORE than 14'],
            [365, 15, false, '15 > 14, but 150 is not > 365 — the 10% arm is the greater one'],
            [365, 36, false, '360 is not > 365'],
            [365, 37, true, '37 > 14 and 370 > 365 — this row was hand-typed FALSE first, and the suite caught it'],
            [100, 10, false, '10 is not > 14'],
            [100, 14, false, '14 is not > 14'],
            [100, 15, true, '15 > 14 and 150 > 100'],
            [140, 14, false, 'both arms are exactly 14, and 14 is not more than 14'],
            [140, 15, true, '15 > 14 and 150 > 140'],
            [0, 15, true, 'never let at fair rental value, and used personally for 15 days'],
            [0, 14, false, '14 is not > 14 even with no rental days at all'],
        ]
        assertEq(cases.length, 12)
        for (const [fair, personal, expected, why] of cases) {
            assertEq(usedAsAHome(fair)(personal), expected, `${fair}/${personal}: ${why}`)
        }
        // The 37/365 row is the one worth stating twice, and it is the row
        // that was hand-typed WRONG the first time this table was written: 10%
        // of 365 is 36.5, and this engine compares 37 * 10 = 370 against 365
        // rather than 37 against 36.5, so it answers TRUE. Both readings agree
        // here, and the integer form is what avoids ever rounding 36.5.
        assertEq(usedAsAHome(365)(37), true)
        assertEq(usedAsAHome(365)(36), false, '360 is not more than 365')
        assertEq(personalUseDayThreshold, 14)
        assertEq(deMinimisRentalDayThreshold, 15)
    },
    // ── The computing cases ──────────────────────────────────────────────────
    aReturnWithNoRentalPropertyIsAPartOfDocumentedZeros: () => {
        const result = ok(run({}))
        assertEq(result.columns.length, 0)
        for (const line of [result.line23a, result.line23b, result.line23c, result.line23d,
            result.line23e, result.line24, result.line25, result.line26]) {
            assertEq(line.value, 0n)
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0]?.boxPath, 'declaredKinds')
        }
        assertEq(result.alternativeMinimumTaxAdjustmentCents, 0n)
    },
    /**
     * ★ **THE WORKED CASE.** Every figure hand-typed off the printed page and
     * the arithmetic a reader can redo without running anything:
     *
     * ```
     *   3  rents received                              24,000.00
     *   9  insurance                                    1,240.00
     *  12  mortgage interest paid to banks              8,600.00
     *  14  repairs                                        975.50
     *  16  taxes                                        3,180.00
     *  20  total expenses  1,240.00 + 8,600.00 + 975.50 + 3,180.00 = 13,995.50
     *  21  24,000.00 - 13,995.50                       10,004.50
     *  24  the one positive line 21                    10,004.50
     *  26  24 + 25                                     10,004.50
     * ```
     */
    oneProfitableResidenceComputesEveryPrintedLine: () => {
        const result = ok(run({
            rentalProperties: [propertyDocument({
                entries: [
                    entryOf('insurance')('1240.00'),
                    entryOf('mortgageInterestPaidToBanks')('8600.00'),
                    entryOf('repairs')('975.50'),
                    entryOf('taxes')('3180.00'),
                ],
            })('sha256-rental-a')],
        }))
        assertEq(result.columns.length, 1)
        const [column] = result.columns
        assert(column !== undefined, ['expected the column', result.columns])
        assertEq(column.line3.value, 2400000n, 'line 3 $24,000.00')
        assertEq(column.line4.value, 0n, 'line 4 is a royalty line')
        assertEq(column.line9.value, 124000n, 'line 9 $1,240.00')
        assertEq(column.line12.value, 860000n, 'line 12 $8,600.00')
        assertEq(column.line14.value, 97550n, 'line 14 $975.50')
        assertEq(column.line16.value, 318000n, 'line 16 $3,180.00')
        assertEq(column.line18.value, 0n, 'no register, so no depreciation')
        assertEq(column.line20.value, 1399550n, 'line 20 $13,995.50')
        assertEq(column.line21.value, 1000450n, 'line 21 $10,004.50')
        assertEq(result.line23a.value, 2400000n, 'line 23a $24,000.00')
        assertEq(result.line23b.value, 0n, 'line 23b no royalties')
        assertEq(result.line23c.value, 860000n, 'line 23c $8,600.00')
        assertEq(result.line23d.value, 0n, 'line 23d no depreciation')
        assertEq(result.line23e.value, 1399550n, 'line 23e $13,995.50')
        assertEq(result.line24.value, 1000450n, 'line 24 $10,004.50')
        assertEq(result.line25.value, 0n, 'line 25 is a structural zero')
        assertEq(result.line26.value, 1000450n, 'line 26 -> Schedule 1 line 5')
        // Printed line 26 cites BOTH a document and the profile: the rent it
        // is made of, and the `declaredKinds` box that says the taxpayer
        // asked for this part at all. See line 25's own comment for why this
        // is NOT the assertion that catches line 25 being dropped from the
        // sum -- it was tried, and it does not.
        const line26Boxes = result.line26.sources.map(source => source.boxPath)
        assert(line26Boxes.includes('declaredKinds'),
            ['line 26 must carry the profile citation', line26Boxes])
        assert(line26Boxes.includes('rentsReceived'),
            ['and the document the rent came from', line26Boxes])
        // Provenance: line 3 cites the document, not the profile.
        assertEq(column.line3.sources.length, 1)
        assertEq(column.line3.sources[0]?.documentHash, 'sha256-rental-a')
        assertEq(column.line3.sources[0]?.boxPath, 'rentsReceived')
        assertEq(column.line3.sources[0]?.value, '24000.00')
        assertEq(column.line12.sources[0]?.boxPath, 'entries[category=mortgageInterestPaidToBanks]')
    },
    /**
     * ★ **LINE 18 OFF THE ASSET REGISTER, at Publication 946's Table A-6.**
     *
     * A $275,000.00 residential rental building placed in service in March
     * 2025. Table A-6, 27.5-year residential rental property, mid-month, year
     * 1, **month 3: 2.879%** — hand-typed off the printed table.
     * $275,000.00 x 2.879% = **$7,917.25**.
     *
     * ```
     *   3  rents received                              24,000.00
     *  18  depreciation, Form 4562 line 22              7,917.25
     *  20  total expenses                               7,917.25
     *  21  24,000.00 - 7,917.25                        16,082.75
     * ```
     *
     * Straight line over 27.5 years is not a 200% declining balance method, so
     * §56(a)(1)(A) makes **no** AMT adjustment: i4562's own rule is that real
     * property under the straight line method has none.
     */
    theRegisterReachesPrintedLineEighteenAtTableASix: () => {
        const result = ok(run({
            rentalProperties: [propertyDocument({})('sha256-rental-a')],
            assetRegisters: [buildingRegister('sha256-register-a')],
        }))
        const [column] = result.columns
        assert(column !== undefined, ['expected the column', result.columns])
        assertEq(column.line18.value, 791725n, 'Table A-6 month 3 year 1: 2.879% of $275,000.00')
        assertEq(column.line20.value, 791725n, 'line 20 is the depreciation alone')
        assertEq(column.line21.value, 1608275n, 'line 21 $16,082.75')
        assertEq(result.line23d.value, 791725n, 'line 23d totals line 18')
        assertEq(result.line26.value, 1608275n)
        // The provenance names the register, not the profile.
        assertEq(column.line18.sources.length, 1)
        assertEq(column.line18.sources[0]?.documentHash, 'sha256-register-a')
        assertEq(column.line18.sources[0]?.boxPath, 'assets -> Form 4562 line 22')
        assertEq(column.line18.sources[0]?.value, '7917.25')
        // Real property under the straight line method has no AMT adjustment.
        assertEq(result.alternativeMinimumTaxAdjustmentCents, 0n)
        assert(column.form4562 !== undefined, ['the completed Form 4562 travels out'])
        // A register that matches NOTHING is simply not this property's: the
        // control that keeps the accountNumber match load-bearing.
        const unmatched = ok(run({
            rentalProperties: [propertyDocument({})('sha256-rental-a')],
            assetRegisters: [{
                documentHash: 'sha256-register-b',
                value: { ...buildingRegister('x').value, accountNumber: 'SOME-OTHER' },
            }],
        }))
        assertEq(unmatched.columns[0]?.line18.value, 0n,
            'a register for another activity does not depreciate this property')
    },
    /**
     * ★ **A ROYALTY COMPUTES WITHOUT ANY OF THE RENTAL MACHINERY.** No line 1a,
     * no line 2, no §280A, no §469 — printed code 6, printed line 4, and the
     * expense block.
     *
     * ```
     *   4  royalties received                           3,200.00
     *  10  legal and other professional fees              450.00
     *  20  total expenses                                 450.00
     *  21  3,200.00 - 450.00                            2,750.00
     * ```
     */
    aRoyaltyComputesOnItsOwnPrintedLineFour: () => {
        const result = ok(run({
            rentalProperties: [propertyDocument({
                accountNumber: 'ROY-0001',
                propertyType: 'royalties',
                physicalAddress: undefined,
                fairRentalDays: undefined,
                personalUseDays: undefined,
                rentsReceived: undefined,
                royaltiesReceived: '3200.00',
                entries: [entryOf('legalAndOtherProfessionalFees')('450.00')],
            })('sha256-royalty-a')],
        }))
        const [column] = result.columns
        assert(column !== undefined, ['expected the column', result.columns])
        assertEq(column.royalty, true)
        assertEq(column.line3.value, 0n, 'a royalty has no line 3')
        assertEq(column.line4.value, 320000n, 'line 4 $3,200.00')
        assertEq(column.line20.value, 45000n)
        assertEq(column.line21.value, 275000n, 'line 21 $2,750.00')
        assertEq(result.line23a.value, 0n, 'line 23a totals RENTS')
        assertEq(result.line23b.value, 320000n, 'line 23b totals ROYALTIES')
        assertEq(result.line26.value, 275000n)
        assertEq(column.line4.sources[0]?.boxPath, 'royaltiesReceived')
    },
    /**
     * Two properties, both profitable, combined on lines 23a-26 — the printed
     * page's own instruction (i1040se p2). A rental at $10,004.50 beside a
     * royalty at $2,750.00 gives line 26 = **$12,754.50**.
     */
    manyPropertiesCombineOnLinesTwentyThreeThroughTwentySix: () => {
        const result = ok(run({
            rentalProperties: [
                propertyDocument({
                    entries: [
                        entryOf('insurance')('1240.00'),
                        entryOf('mortgageInterestPaidToBanks')('8600.00'),
                        entryOf('repairs')('975.50'),
                        entryOf('taxes')('3180.00'),
                    ],
                })('sha256-rental-a'),
                propertyDocument({
                    accountNumber: 'ROY-0001',
                    propertyType: 'royalties',
                    physicalAddress: undefined,
                    fairRentalDays: undefined,
                    personalUseDays: undefined,
                    rentsReceived: undefined,
                    royaltiesReceived: '3200.00',
                    entries: [entryOf('legalAndOtherProfessionalFees')('450.00')],
                })('sha256-royalty-a'),
            ],
        }))
        assertEq(result.columns.length, 2)
        assertEq(result.line23a.value, 2400000n)
        assertEq(result.line23b.value, 320000n)
        assertEq(result.line23c.value, 860000n)
        assertEq(result.line23e.value, 1444550n, '$13,995.50 + $450.00')
        assertEq(result.line24.value, 1275450n, '$10,004.50 + $2,750.00')
        assertEq(result.line26.value, 1275450n)
    },
    // ── The refusals, each with its control ──────────────────────────────────
    refusals: {
        /**
         * ★ **THE ASYMMETRY.** A rental LOSS refuses naming Form 8582 and
         * §469; the SAME property one dollar the other side of break-even
         * computes. $24,000.00 of rent against $24,000.01 of expenses is a
         * one-cent loss.
         */
        aRentalLossRefusesNamingFormEightFiveEightTwo: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({
                    entries: [entryOf('repairs')('24000.01')],
                })('sha256-rental-a')],
            }))
            assert(message.includes('Form 8582'), ['the form the filer needs', message])
            assert(message.includes('§469'), ['the statute', message])
            assert(message.includes('$25,000'), ['the special allowance that is out of reach', message])
            assert(message.includes('LOSS of 0.01'), ['the SIZE of the loss', message])
            assert(message.includes('line 21'), ['the printed line', message])
            assert(message.includes('RENT-0001'), ['which property', message])
            // THE CONTROL, one cent the other way: $24,000.00 against
            // $24,000.00 is a break-even zero, and zero is not a loss.
            const evenOutcome = ok(run({
                rentalProperties: [propertyDocument({
                    entries: [entryOf('repairs')('24000.00')],
                })('sha256-rental-a')],
            }))
            assertEq(evenOutcome.line26.value, 0n, 'break-even computes, and it is not a loss')
            assertEq(evenOutcome.line24.value, 0n, 'printed line 24 adds only POSITIVE amounts')
        },
        /**
         * A ROYALTY loss refuses through a different function naming a
         * different form: Form 6198 and §465, never Form 8582.
         */
        aRoyaltyLossNamesFormSixtyOneNinetyEightAndNotFormEightFiveEightTwo: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({
                    accountNumber: 'ROY-0001',
                    propertyType: 'royalties',
                    physicalAddress: undefined,
                    fairRentalDays: undefined,
                    personalUseDays: undefined,
                    rentsReceived: undefined,
                    royaltiesReceived: '3200.00',
                    entries: [entryOf('other')('3500.00')],
                })('sha256-royalty-a')],
            }))
            assert(message.includes('Form 6198'), ['the form the filer needs', message])
            assert(message.includes('§465'), ['the statute', message])
            assert(message.includes('LOSS of 300.00'), ['the SIZE of the loss', message])
            assert(!message.includes('Form 8582') || message.includes('is not the blocker'),
                ['a royalty loss must not be told to file Form 8582', message])
            assert(message.includes('royalty'), ['which kind of column', message])
        },
        /**
         * ★ **§280A, all three regimes, with the zero-personal-use control.**
         * Every expectation hand-derived from i1040se p5.
         */
        everyPersonalUseDayRefusesAndTheRegimeIsNamed: () => {
            // §280A(e): 20 personal days against 365 fair rental days. 20 > 14
            // but 200 is not > 365, so NOT a home.
            const allocation = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 365, personalUseDays: 20,
                })('sha256-rental-a')],
            }))
            assert(allocation.includes('§280A(e)'), ['the allocation regime', allocation])
            assert(allocation.includes('did NOT use the unit as a home'), ['which side of the test', allocation])
            assert(allocation.includes('Schedule A'), ['where the disallowed share goes', allocation])
            assert(allocation.includes('Bolton'), ['why the day count is contested', allocation])
            assert(allocation.includes('RENT-0001'), ['and WHICH property the filer must look at', allocation])
            // §280A(c)(5): 30 personal days against 100 fair rental days.
            // 30 > 14 and 300 > 100, so a home; 100 >= 15, so the CAP.
            const cap = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 100, personalUseDays: 30,
                })('sha256-rental-a')],
            }))
            assert(cap.includes('§280A(c)(5)'), ['the cap regime', cap])
            assert(cap.includes('Pub. 527'), ['the worksheet', cap])
            assert(cap.includes('CARRIED FORWARD'), ['why the cap cannot be computed', cap])
            // §280A(g): 30 personal days against 10 fair rental days. A home,
            // and fewer than 15 rental days, so the income is EXCLUDED.
            const excluded = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 10, personalUseDays: 30,
                })('sha256-rental-a')],
            }))
            assert(excluded.includes('§280A(g)'), ['the exclusion regime', excluded])
            assert(excluded.includes('do not report the rental income'), ['the printed instruction', excluded])
            // ★ **THE BOUNDARY A MUTATION DEMANDED.** Moving
            // `deMinimisRentalDayThreshold` from 15 to 14 reddened only the
            // predicate table above, because every fixture here sat far from
            // the boundary: 10 fair rental days is below both. These two sit
            // ON it. i1040se p5 says "fewer than 15 days", so 14 is §280A(g)
            // and 15 is §280A(c)(5), with 30 personal days making both a home.
            const fourteenDays = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 14, personalUseDays: 30,
                })('sha256-rental-a')],
            }))
            assert(fourteenDays.includes('§280A(g)'), ['14 fair rental days is FEWER than 15', fourteenDays])
            const fifteenDays = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 15, personalUseDays: 30,
                })('sha256-rental-a')],
            }))
            assert(fifteenDays.includes('§280A(c)(5)'), ['15 is not fewer than 15', fifteenDays])
            // The three messages must be DIFFERENT, which is the property a
            // per-regime assertion alone cannot check.
            assertEq(new Set([allocation, cap, excluded]).size, 3)
            // THE CONTROL: one personal day fewer than any of them — zero —
            // and the identical property computes.
            const clean = ok(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 100, personalUseDays: 0,
                })('sha256-rental-a')],
            }))
            assertEq(clean.line26.value, 2400000n, 'no personal use, so §280A never fires')
            // And the boundary: ONE personal day refuses, though it is neither
            // a home nor anything like one.
            const oneDay = refusal(run({
                rentalProperties: [propertyDocument({
                    fairRentalDays: 364, personalUseDays: 1,
                })('sha256-rental-a')],
            }))
            assert(oneDay.includes('§280A(e)'), ['one day is still an allocation', oneDay])
        },
        /**
         * ★ **PRINTED TYPE CODE 7 REFUSES**, and the control is every other
         * code. Without this refusal, `fjs/form8960`'s line 4b could not be a
         * structural zero and a self-rental's income would be taxed 3.8%
         * under §1411 against Reg. §1.1411-4(g)(6).
         */
        aSelfRentalRefusesForFormEightNineSixtyLineFourB: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({ propertyType: 'selfRental' })('sha256-rental-a')],
            }))
            assert(message.includes('code 7'), ['the printed code', message])
            assert(message.includes('\u00a71.469-2(f)(6)'), ['the \u00a7469 recharacterization', message])
            assert(message.includes('\u00a71.1411-4(g)(6)'), ['the \u00a71411 exclusion', message])
            assert(message.includes('Form 8960 line 4b'), ['the printed line that cannot be computed', message])
            assert(message.includes('RENT-0001'), ['and which property', message])
            // THE CONTROL: the other SEVEN printed codes all compute. A
            // refusal that fired on every type would pass the assertions above.
            const otherCodes = [
                'singleFamilyResidence', 'multiFamilyResidence', 'vacationOrShortTermRental',
                'commercial', 'land', 'other',
            ]
            assertEq(otherCodes.length, 6, 'eight printed codes, less royalties and less self-rental')
            for (const propertyType of otherCodes) {
                const outcome = ok(run({
                    rentalProperties: [propertyDocument(propertyType === 'other'
                        ? { propertyType, otherTypeDescription: 'billboard site' }
                        : { propertyType })('sha256-rental-a')],
                }))
                assertEq(outcome.line26.value, 2400000n, propertyType)
            }
            // And the seventh, the royalty, which takes a different shape.
            const royalty = ok(run({
                rentalProperties: [propertyDocument({
                    accountNumber: 'ROY-0001',
                    propertyType: 'royalties',
                    physicalAddress: undefined,
                    fairRentalDays: undefined,
                    personalUseDays: undefined,
                    rentsReceived: undefined,
                    royaltiesReceived: '3200.00',
                })('sha256-royalty-a')],
            }))
            assertEq(royalty.line26.value, 320000n)
        },
        anUnknownCategoryRefusesByName: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({
                    entries: [entryOf('moonBeams')('10.00')],
                })('sha256-rental-a')],
            }))
            assert(message.includes("'moonBeams'"), ['the offending value', message])
            assert(message.includes('advertising'), ['the vocabulary', message])
            // THE CONTROL: every printed category is accepted. Fifteen
            // entries, minus the two that refuse for their own reasons.
            for (const row of rentalExpenseLines) {
                if (refusedCategories.includes(row.category)) {
                    continue
                }
                const outcome = ok(run({
                    rentalProperties: [propertyDocument({
                        entries: [entryOf(row.category)('1.00')],
                    })('sha256-rental-a')],
                }))
                assertEq(outcome.columns[0]?.line20.value, 100n, row.category)
            }
        },
        autoAndTravelRefusesForFormFortyFiveSixtyTwoPartFive: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({
                    entries: [entryOf('autoAndTravel')('340.00')],
                })('sha256-rental-a')],
            }))
            assert(message.includes('line 6'), ['the printed line', message])
            assert(message.includes('Part V of Form 4562'), ['the printed instruction', message])
            assert(message.includes('RENT-0001'), ['and which property', message])
            assert(message.includes('340.00'), ['the amount', message])
            assert(message.includes('§274(d)'), ['the substantiation rule', message])
        },
        aStoredDepreciationEntryRefusesBecauseTheLineIsComputed: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({
                    entries: [entryOf('depreciationOrDepletion')('5000.00')],
                })('sha256-rental-a')],
            }))
            assert(message.includes('line 18'), ['the printed line', message])
            assert(message.includes('TWICE'), ['why an entry cannot stand', message])
            assert(message.includes('vnd.fjs.asset_register'), ['what to store instead', message])
            assert(message.includes('DEPLETION'), ['the other half of the printed line', message])
            assert(message.includes('RENT-0001'), ['and which property', message])
        },
        twoDocumentsForOnePropertyRefuse: () => {
            const message = refusal(run({
                rentalProperties: [
                    propertyDocument({})('sha256-rental-a'),
                    propertyDocument({ rentsReceived: '24500.00' })('sha256-rental-b'),
                ],
            }))
            assert(message.includes("'RENT-0001'"), ['the account number', message])
            assert(message.includes('twice'), ['what would go wrong', message])
            // THE CONTROL: two DIFFERENT properties compute.
            const two = ok(run({
                rentalProperties: [
                    propertyDocument({})('sha256-rental-a'),
                    propertyDocument({ accountNumber: 'RENT-0002' })('sha256-rental-b'),
                ],
            }))
            assertEq(two.columns.length, 2)
            assertEq(two.line26.value, 4800000n, '$24,000.00 twice')
        },
        twoRegistersForOnePropertyRefuse: () => {
            const message = refusal(run({
                rentalProperties: [propertyDocument({})('sha256-rental-a')],
                assetRegisters: [
                    buildingRegister('sha256-register-a'),
                    {
                        documentHash: 'sha256-register-b',
                        value: {
                            ...buildingRegister('x').value,
                            businessOrActivity: '18 Alder Street appliances',
                        },
                    },
                ],
            }))
            assert(message.includes('18 Alder Street rental'), ['the first activity', message])
            assert(message.includes('18 Alder Street appliances'), ['the second', message])
            assert(message.includes('mid-quarter'), ['why merging is wrong', message])
        },
        // Form 4562's OWN refusals travel out verbatim, so a register this
        // engine cannot complete never produces a Part I short by the
        // depreciation.
        aFormFortyFiveSixtyTwoRefusalTravelsOutUnchanged: () => {
            const register = buildingRegister('sha256-register-a')
            const [asset] = register.value.assets
            assert(asset !== undefined, ['expected the asset'])
            assert(asset !== undefined, ['expected the asset'])
            const message = refusal(run({
                rentalProperties: [propertyDocument({})('sha256-rental-a')],
                assetRegisters: [{
                    documentHash: register.documentHash,
                    value: {
                        ...register.value,
                        assets: [{ ...asset, listedProperty: true }],
                    },
                }],
            }))
            assert(message.includes('Form 4562'), ['the refusal is Form 4562\'s own', message])
            assert(message.includes('residential rental building'), ['and it names the asset', message])
        },
    },
}
