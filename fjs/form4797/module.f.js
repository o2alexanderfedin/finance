/**
 * Form 4797 — *Sales of Business Property (Also Involuntary Conversions and
 * Recapture Amounts Under Sections 179 and 280F(b)(2))*.
 *
 * Spec:
 * [./todo/sales-of-business-property.md](./todo/sales-of-business-property.md),
 * written before this file. Every claim below cites the printed 2025
 * `f4797.pdf` face (Cat. No. 13086I), its instructions `i4797.pdf`
 * (Cat. No. 13087T, Jul 28 2025) by the page number in the footer, `i4562.pdf`
 * for Step 3's disposal decimal, or `i1040sd.pdf` p.12 for the *Unrecaptured
 * Section 1250 Gain Worksheet*.
 *
 * ## What this computes, in one sentence
 *
 * Every `disposal` block on every stored `vnd.fjs.asset_register` becomes a
 * printed row — Part III if the property was held more than a year and sold at
 * a gain, Part I if it was held more than a year and sold at a loss, Part II if
 * it was held a year or less — and the three Parts net into line 18b (Schedule
 * 1 line 4), a §1231 long-term capital gain (Schedule D line 11) and an
 * unrecaptured §1250 gain (Schedule D line 19's worksheet).
 *
 * ## A LOSS computes; a GAIN needs a certification. The printed page is why
 *
 * Line 7's own instruction, verbatim:
 *
 * > *"Individuals, partners, S corporation shareholders, and all others. If
 * > line 7 is zero or a loss, enter the amount from line 7 on line 11 below and
 * > **skip lines 8 and 9**. If line 7 is a gain and you didn't have any prior
 * > year section 1231 losses, or they were recaptured in an earlier year, enter
 * > the gain from line 7 as a long-term capital gain on the Schedule D filed
 * > with your return and skip lines 8, 9, 11, and 12 below."*
 *
 * §1231(c)'s five-year lookback lives on printed line 8, and **a loss never
 * passes through line 8**. So a §1231 loss year is fully computable with no
 * prior-year figure at all, and a §1231 gain year needs one. That asymmetry is
 * the exact mirror of `fjs/schedule/e/part_i`'s, where a PROFIT computes and a
 * LOSS refuses because §469 sits on printed line 22 — and like that one, it is
 * the page's asymmetry rather than this engine's.
 *
 * **Line 7 = 0 computes too, and it is the ordinary equipment case.** §1245
 * caps the recapture at the total gain (line 25b is *"the smaller of line 24 or
 * 25a"*), so a machine sold for less than it originally cost has line 25b =
 * line 24, line 31 = line 30, line 32 = 0 and therefore line 6 = 0. A return
 * whose only disposal is a fully-recaptured machine reaches line 7 = 0 and
 * never looks at the lookback. That is what makes this form worth having under
 * a prior-year blocker.
 *
 * The certification `vnd.fjs.return_profile` carries for the gain case names
 * the printed sentence above, and it lives on the RETURN profile rather than on
 * a register because §1231 nets across the whole return while a register is one
 * business (i4562 p1: *"File a separate Form 4562 for each business or
 * activity"*). {@link sectionTwelveThirtyOneLookbackRefusal} is the refusal
 * without it, at printed line 8.
 *
 * ## Depreciation allowed OR ALLOWABLE, derived and never transcribed
 *
 * i4797 p9's line 22 Step 1: *"Deductions allowed **or allowable** for
 * depreciation (including any special depreciation allowance …)"*. A taxpayer
 * who under-claimed still recaptures, so line 22 can never be a stored "what I
 * actually deducted".
 *
 * `fjs/form4562`'s `depreciationAllowedOrAllowableCents` derives it, and the
 * reason it can is the same property that let `vnd.fjs.asset_register` omit
 * accumulated depreciation in the first place: Publication 946 Table A-1's own
 * header is *"Multiply your property's unadjusted basis each year by the
 * percentage"*, so year `n`'s deduction is a function of the unadjusted basis
 * and the elapsed years and never of what was deducted — which is what
 * *allowable* means. **There is no "asset predates the register" case**: the
 * register refuses any `datePlacedInService` before 1987 by name, so every
 * asset it can hold is MACRS property whose column runs from recovery year 1.
 *
 * ## §1250 recapture is a STRUCTURAL zero, and unrecaptured §1250 gain is not
 *
 * Printed line 26's header: *"If section 1250 property: If straight line
 * depreciation was used, enter -0- on line 26g, except for a corporation
 * subject to section 291."* And i4797 p10: *"Section 1250 recapture does not
 * apply to dispositions of the following MACRS property placed in service after
 * 1986 … 27.5-year … residential rental property … 22-, 31.5-, or 39-year …
 * nonresidential real property."*
 *
 * Both premises are enforced one layer down and cannot be otherwise:
 * `macrsClassifications` gives `residentialRental` and `nonresidentialReal` the
 * single permitted method `SL`, and the register refuses pre-1987 property. §291
 * is corporations only. So lines 26a-26g are zero for every §1250 property this
 * engine can hold, as a consequence of two upstream refusals rather than as an
 * approximation.
 *
 * The 25%-rate gain is a different figure and does not vanish. §1(h)(1)(E)
 * taxes *unrecaptured section 1250 gain* at up to 25%, and i1040sd p.12's
 * worksheet computes it from this form's own lines 22, 24, 26g, 7 and 8 —
 * lines 1 through 9, which `fjs/schedule/d` carried as a single documented zero
 * until this phase. {@link Form4797Ok} carries the three figures that worksheet
 * needs.
 *
 * ## Which disposals can be spelled, and which refuse
 *
 * The register can spell a depreciable MACRS asset used in a trade or business.
 * i4797 p1's *Where To Make First Entry* chart has eight rows and this engine
 * serves parts of two of them; the rest refuse by name, and four of those
 * refusals are DETECTABLE from stored documents rather than merely documented:
 *
 * - {@link farmDisposalRefusal} — a register bound to a stored `vnd.fjs.farm`.
 *   Cattle and horses take a 24-month holding period and other livestock 12
 *   months (i4797 p6, §1231(b)(3)), and §1252 farmland is printed lines
 *   27a-27c. Nothing on a register says "this asset is a cow".
 * - {@link ambiguousSectionRefusal} — 15- and 20-year property, whose class
 *   straddles §1245 and §1250. See {@link sectionOfClassification}.
 * - {@link partialBusinessUseRefusal} — business use below 100%.
 * - {@link scheduleDNotFiledRefusal} — a §1231 gain on a return that files no
 *   Schedule D, which is where printed line 7 sends it.
 *
 * Undetectable and therefore named rather than guarded: land sold with a
 * building (i4797 p2 allocates by FMV, which nothing stores), §1254 mineral
 * property, §1255 cost-sharing property, de minimis safe harbor property,
 * §1244 stock and a mark-to-market trader's securities. `fjs/return/scope`'s
 * `otherGainsOrLosses` remedy names them.
 *
 * ## Part IV is structurally unreachable
 *
 * Lines 33-35 recapture §179 and §280F(b)(2) *"When Business Use Drops to 50%
 * or Less"*. Column (a) needs a §179 expense deduction and column (b) needs
 * listed property; `fjs/form4562` refuses both outright, so no computable
 * return can reach Part IV. It has no fields here, for the reason Form 4562's
 * Part I lines 1-11 have none: a line that cannot bind is not modelled.
 *
 * ## This module does not read documents
 *
 * It receives already-selected, already-validated stored values and returns a
 * value. Its refusals are RETURNED, never thrown.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsToString } from '../exact/module.f.js'
import { format } from '../types/decimal/module.f.js'
import {
    depreciableAssets, fullBusinessUseHundredths,
} from '../document/asset_register/module.f.js'
import { depreciationAllowedOrAllowableCents } from '../form4562/module.f.js'
import { macrsClassificationNames, expectedClassificationCount } from '../form4562/macrs/module.f.js'

/** @import { AssetRegister, RegisteredAsset } from '../document/asset_register/module.f.js' */
/** @import { Farm } from '../document/farm/module.f.js' */
/** @import { ReturnProfile } from '../return/profile/module.f.js' */
/** @import { AssetDisposal, DepreciableAsset } from '../form4562/module.f.js' */
/** @import { Source } from '../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A document as stored: its CAS hash beside its already-validated value — the
 * same local `Stored<T>` every form and schedule module in this repo declares
 * for itself. Nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything this form needs.
 *
 * `profile` carries the §1231 lookback certification and the declared kinds
 * that decide whether a Schedule D is filed at all; `assetRegisters` carry the
 * disposals; `farmForms` are read for PRESENCE only, to refuse a disposal on a
 * farm's register — the same "read for presence, never for an amount" role
 * `businessExpenseForms` has in `fjs/schedule/f`.
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly farmForms: readonly Stored<Farm>[],
 * }} Form4797Inputs
 */

// ── Outputs ──────────────────────────────────────────────────────────────────

/**
 * One printed line 2 (Part I) or line 10 (Part II) row — the same six columns
 * on both lines, which is why one type serves both.
 *
 * `gainOrLossCents` is printed column (g), *"Subtract (f) from the sum of (d)
 * and (e)"*. Written exactly that way rather than as
 * `grossSalesPrice - adjustedBasis`, because the two are equal only when
 * column (e) really is the depreciation embedded in column (f), and writing the
 * printed form of it is what makes a wrong column (e) visible.
 * @typedef {{
 *   readonly description: string,
 *   readonly dateAcquired: string,
 *   readonly dateSold: string,
 *   readonly grossSalesPriceCents: bigint,
 *   readonly depreciationAllowedCents: bigint,
 *   readonly costPlusExpenseOfSaleCents: bigint,
 *   readonly gainOrLossCents: bigint,
 * }} Form4797SaleRow
 */

/**
 * One printed Part III property column (A through D on the face), every line
 * under its printed number.
 *
 * `unrecapturedSectionTwelveFiftyGainCents` is NOT a Form 4797 line. It is
 * i1040sd p.12's *Unrecaptured Section 1250 Gain Worksheet* line 3 for this
 * property — line 1 (*"the smaller of line 22 or line 24"*) less line 2
 * (*"Form 4797, line 26g"*) — computed here because only this module holds both
 * halves, exactly as `fjs/form4562` carries the Form 6251 line 2l adjustment
 * that is not a Form 4562 line either.
 * @typedef {{
 *   readonly description: string,
 *   readonly dateAcquired: string,
 *   readonly dateSold: string,
 *   readonly line20GrossSalesPriceCents: bigint,
 *   readonly line21CostPlusExpenseOfSaleCents: bigint,
 *   readonly line22DepreciationCents: bigint,
 *   readonly line23AdjustedBasisCents: bigint,
 *   readonly line24TotalGainCents: bigint,
 *   readonly line25aCents: bigint,
 *   readonly line25bCents: bigint,
 *   readonly line26gCents: bigint,
 *   readonly unrecapturedSectionTwelveFiftyGainCents: bigint,
 * }} Form4797PartIIIProperty
 */

/**
 * Form 4797, computed. Every field is one printed line, in printed order,
 * except the three at the end that are what other forms take.
 *
 * `line11Cents` is a NEGATIVE bigint or zero: the printed face prints it as
 * `11 (        )`, which is the paper's way of writing a negative, and storing
 * the magnitude would put a sign convention between this module and its reader
 * that nothing enforces. `fjs/form6781`'s `line2LossColumnCents` set that
 * precedent.
 *
 * `filed` distinguishes "no disposals at all" from "disposals that netted to
 * zero" — a caller printing Schedule 1 line 4 needs the first to be a
 * profile-declared zero citing no document, and the second to be a computed
 * zero citing the register.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly filed: boolean,
 *   readonly line1aCents: bigint,
 *   readonly line1bCents: bigint,
 *   readonly line1cCents: bigint,
 *   readonly line2Rows: readonly Form4797SaleRow[],
 *   readonly line3Cents: bigint,
 *   readonly line4Cents: bigint,
 *   readonly line5Cents: bigint,
 *   readonly line6Cents: bigint,
 *   readonly line7Cents: bigint,
 *   readonly line8Cents: bigint,
 *   readonly line9Cents: bigint,
 *   readonly line10Rows: readonly Form4797SaleRow[],
 *   readonly line11Cents: bigint,
 *   readonly line12Cents: bigint,
 *   readonly line13Cents: bigint,
 *   readonly line14Cents: bigint,
 *   readonly line15Cents: bigint,
 *   readonly line16Cents: bigint,
 *   readonly line17Cents: bigint,
 *   readonly line18aCents: bigint,
 *   readonly line18bCents: bigint,
 *   readonly partIIIProperties: readonly Form4797PartIIIProperty[],
 *   readonly line30Cents: bigint,
 *   readonly line31Cents: bigint,
 *   readonly line32Cents: bigint,
 *   readonly longTermCapitalGainCents: bigint,
 *   readonly unrecapturedSectionTwelveFiftyGainCents: bigint,
 *   readonly sources: readonly Source[],
 * }} Form4797Ok
 */

/**
 * `longTermCapitalGainCents`, `unrecapturedSectionTwelveFiftyGainCents` and
 * `line8Cents` are the three figures i1040sd p.12's *Unrecaptured Section 1250
 * Gain Worksheet* takes from this form, and the split between what is computed
 * here and what is computed in `fjs/schedule/d` is deliberate:
 *
 * - `unrecapturedSectionTwelveFiftyGainCents` is the worksheet's line 3 summed
 *   over the Part III properties — *"the smaller of line 22 or line 24"* less
 *   *"the amount from Form 4797, line 26g"* — UNCAPPED. Only this module holds
 *   lines 22, 24 and 26g.
 * - The worksheet's lines 4, 5 and 6 add Form 6252 and Schedule K-1 amounts
 *   this form knows nothing about, and its line 7 is *"the smaller of line 6 or
 *   the gain from Form 4797, line 7"*. That cap belongs where the other
 *   summands are, which is `fjs/schedule/d`.
 * - `longTermCapitalGainCents` is that cap's second argument, and it is `0n`
 *   whenever line 7 is not a gain — which is the worksheet's own opening
 *   sentence, *"If you aren't reporting a gain on Form 4797, line 7, skip lines
 *   1 through 9."*
 */

/**
 * A case this form will not compute — the same shape `fjs/form6781`,
 * `fjs/form8949` and `fjs/schedule/d` already return.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form4797Refusal
 */

/** @typedef {Form4797Ok | Form4797Refusal} Form4797Outcome */

// ── §1245 or §1250: what the classification can and cannot decide ────────────

/**
 * The classifications i4797 p10's §1245 list covers. *"Section 1245 property is
 * property that is depreciable … and is one of the following: **Personal
 * property**; …"*, and the members of these four classes that are arguably real
 * property — *"A single purpose agricultural or horticultural structure (as
 * defined in section 168(i)(13))"* — are named in that same §1245 list.
 */
export const sectionTwelveFortyFiveClassifications = /** @type {const} */ ([
    'threeYear', 'fiveYear', 'sevenYear', 'tenYear',
])

/**
 * The classifications that are §1250 property. i4797 p10, line 26: *"Section
 * 1250 property is depreciable real property (other than section 1245
 * property)."* Both of these are real property by definition, both are
 * straight-line-only in `macrsClassifications`, and both are therefore
 * zero-recapture under i4797 p10's own exclusion for post-1986 MACRS.
 */
export const sectionTwelveFiftyClassifications = /** @type {const} */ ([
    'residentialRental', 'nonresidentialReal',
])

/**
 * The two classes that STRADDLE, and are refused rather than guessed at.
 *
 * The 15-year class holds both §1245 personal property and §1250 land
 * improvements and qualified improvement property; the 20-year class holds both
 * municipal sewers and §1250 farm buildings. `vnd.fjs.asset_register` carries
 * nothing that separates them.
 *
 * **The guess is not close to free.** For post-1986 property the two
 * characterizations differ by the WHOLE recapture: §1245 turns every dollar of
 * depreciation into ordinary income on line 25b, and §1250 on straight-line
 * MACRS recaptures nothing at all. Guessing is a coin flip between "all
 * ordinary" and "all §1231". The field that would retire this is a
 * `section1245OrSection1250` legal status in `section168kStatus`'s exact
 * shape — a frozen string vocabulary the taxpayer asserts — and it is
 * deliberately not added: the refusal names precisely what to add, and nothing
 * in this repository needs it yet.
 */
export const straddlingClassifications = /** @type {const} */ (['fifteenYear', 'twentyYear'])

/**
 * Independently hand-typed sizes of the three lists above, in the
 * `expectedClassificationCount` idiom. Deliberately NOT `.length`: the proof
 * below walks `macrsClassificationNames` to check the three lists PARTITION it,
 * and a name deleted from a list would vanish from that walk in the same
 * instant.
 */
const expectedSectionTwelveFortyFiveCount = 4
const expectedSectionTwelveFiftyCount = 2
const expectedStraddlingCount = 2

/**
 * Which depreciation-recapture section governs one classification, or
 * `undefined` when the class straddles.
 * @type {(classification: string) => 'section1245' | 'section1250' | undefined}
 */
export const sectionOfClassification = classification => {
    if (sectionTwelveFortyFiveClassifications.some(name => name === classification)) {
        return 'section1245'
    }
    if (sectionTwelveFiftyClassifications.some(name => name === classification)) {
        return 'section1250'
    }
    return undefined
}

// ── The holding period ───────────────────────────────────────────────────────

/**
 * *Held more than 1 year*, the test that decides which printed Part a disposal
 * lands in.
 *
 * i4797 p6: *"To figure the holding period, begin counting on the day after you
 * received the property and include the day you disposed of it."* So the
 * holding period exceeds a year exactly when the sale date is strictly after
 * the same calendar day one year on.
 *
 * **One string comparison, and no calendar.** Both dates are zero-padded
 * `YYYY-MM-DD` (the dialect refuses anything else), so lexicographic order is
 * chronological order and advancing the year is four characters of arithmetic.
 *
 * That is exact at the boundary a "365 days later" test gets wrong. Acquired
 * `2024-02-29`: the holding period begins `2024-03-01` and one full year of it
 * completes at the end of `2025-02-28`, so `2025-03-01` is more than a year and
 * `2025-02-28` is not. `'2025-03-01' > '2025-02-29'` is `true` and
 * `'2025-02-28' > '2025-02-29'` is `false` — the right answers, from a date
 * that does not exist, because only the ORDER is ever used.
 * @type {(disposal: AssetDisposal) => boolean}
 */
export const heldMoreThanOneYear = disposal =>
    disposal.soldDate
    > `${Number(disposal.acquiredDate.slice(0, 4)) + 1}${disposal.acquiredDate.slice(4)}`

// ── Refusals ─────────────────────────────────────────────────────────────────

/**
 * Renders a business-use percentage held in HUNDREDTHS of a percent. Not
 * `centsToString`: that function is named for money and reading a percentage
 * through it would be a type pun that happens to work because both are
 * fixed-scale at 2.
 * @type {(hundredthsOfPercent: bigint) => string}
 */
const percentText = format(2)

/**
 * Where this form's three answers end up, quoted in every refusal so the
 * message says what was lost as well as why. AGENTS.md records a verification
 * sweep in which five refusal proofs asserted the box name and the phrase
 * "cannot compute" and not one asserted *where the amount would have gone*.
 * @type {string}
 */
const destination = 'Form 4797 line 18b -> Schedule 1 line 4 -> 1040 line 8 (ordinary), '
    + 'line 7 -> Schedule D line 11 -> 1040 line 7a (§1231 long-term capital gain), and the '
    + 'unrecaptured §1250 gain -> Schedule D line 19, taxed at up to 25% by §1(h)(1)(E)'

/**
 * **R1.** A disposal on a register bound to a stored farm.
 * @type {(businessOrActivity: string) => (description: string) => (accountNumber: string) => Form4797Refusal}
 */
export const farmDisposalRefusal = businessOrActivity => description => accountNumber => ({
    kind: 'error',
    message: `Form 4797: ${JSON.stringify(description)} was disposed of from the register for `
        + `${JSON.stringify(businessOrActivity)}, whose accountNumber ${accountNumber} names a `
        + `stored farm. i4797 p1's "Where To Make First Entry" chart gives farm property three of `
        + `its eight rows and none of them follows the general rule: cattle and horses reach Part `
        + `III only when "held 24 months or more from acquisition date", other livestock at 12 `
        + `months, and farmland on which soil or water expenses were deducted is §1252 and belongs `
        + `on printed lines 27a through 27c. `
        + `vnd.fjs.asset_register carries nothing that says an asset is a cow, so this engine `
        + `cannot tell a breeding heifer held 18 months — Part II, ordinary — from a tractor held `
        + `18 months, which is Part III. Refusing rather than applying the general more-than-1-year `
        + `rule to a herd. Nothing reaches ${destination} (no phase yet)`,
})

/**
 * **R2.** A disposal of property whose MACRS class straddles §1245 and §1250.
 * @type {(description: string) => (classification: string) => Form4797Refusal}
 */
export const ambiguousSectionRefusal = description => classification => ({
    kind: 'error',
    message: `Form 4797: ${JSON.stringify(description)} is ${classification} property, and this `
        + `engine cannot tell whether it is §1245 or §1250 property. The 15-year class holds both `
        + `§1245 personal property and §1250 land improvements and qualified improvement property; `
        + `the 20-year class holds both municipal sewers and §1250 farm buildings. The two answers `
        + `differ by the WHOLE recapture: printed line 25b turns every dollar of depreciation into `
        + `ordinary income for §1245 property, while i4797 p10 says "section 1250 recapture does `
        + `not apply" to post-1986 straight-line MACRS real property, so line 26g is zero and the `
        + `entire gain stays §1231. Guessing would be a coin flip between all-ordinary and `
        + `all-capital. A section1245OrSection1250 status on the register, in section168kStatus's `
        + `frozen-vocabulary shape, is what would retire this (no phase yet). `
        + `Nothing reaches ${destination}`,
})

/**
 * **R3.** A disposal of an asset used less than wholly in the business.
 * @type {(description: string) => (businessUsePercentage: bigint) => Form4797Refusal}
 */
export const partialBusinessUseRefusal = description => businessUsePercentage => ({
    kind: 'error',
    message: `Form 4797: ${JSON.stringify(description)} was used `
        + `${percentText(businessUsePercentage)}% in the business, and this engine will not split `
        + `its disposal. Printed line 21 is "Cost or other basis plus expense of sale" — the WHOLE `
        + `cost — while the depreciable basis is only the business-use share, so the amount `
        + `realized has to be allocated between a business part on this form and a personal part `
        + `on Schedule D. i4797 p3 states the rule for the home case: "Any gain on the personal `
        + `part of the property is a capital gain. You cannot deduct a loss on the personal part." `
        + `This engine has no wiring that carries a personal part anywhere, so computing the `
        + `business side alone would produce a Form 4797 that is right and a Schedule D that is `
        + `short. Nothing reaches ${destination} (no phase yet)`,
})

/**
 * **R4.** A §1231 gain, and no certification that the five-year lookback is
 * empty. Named at the printed line the missing figure belongs on.
 * @type {(line7Cents: bigint) => Form4797Refusal}
 */
export const sectionTwelveThirtyOneLookbackRefusal = line7Cents => ({
    kind: 'error',
    message: `Form 4797 line 8: line 7 is a net §1231 GAIN of `
        + `${centsToString(line7Cents)} and the return profile does not certify `
        + `noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears. Printed line 8 is `
        + `"Nonrecaptured net section 1231 losses from prior years", which i4797 p6 defines as `
        + `"your net section 1231 losses deducted during the 5 preceding tax years that have not `
        + `yet been applied against any net section 1231 gain" — five prior returns plus the `
        + `running ledger of what each has already absorbed, and i4797 p7 calls that ledger a "For `
        + `recordkeeping purposes" figure rather than a printed line anything could be transcribed `
        + `from. This engine models one tax year. §1231(c) makes the gain ORDINARY to the extent `
        + `of that figure, so reading it as zero UNDERSTATES tax for exactly the taxpayer who `
        + `deducted a §1231 loss in the last five years. A LOSS on line 7 needs none of this — the `
        + `printed instruction says to "skip lines 8 and 9" — so this refusal is one-sided by the `
        + `page's own design. Add the certification if the five preceding years hold no `
        + `unrecaptured net §1231 loss. Nothing reaches ${destination}`,
})

/**
 * **R5.** A §1231 gain on a return that files no Schedule D.
 * @type {(line7Cents: bigint) => Form4797Refusal}
 */
export const scheduleDNotFiledRefusal = line7Cents => ({
    kind: 'error',
    message: `Form 4797 line 7: a net §1231 GAIN of ${centsToString(line7Cents)} must go, in the `
        + `printed instruction's own words, "as a long-term capital gain on the Schedule D filed `
        + `with your return" — and this return declares no capitalGainsOrLosses, so no Schedule D `
        + `is filed and there is nowhere for it to land. A §1231 gain is taxed at the long-term `
        + `capital gain rates through Schedule D lines 11 and 16, and any unrecaptured §1250 gain `
        + `inside it at up to 25% through Schedule D line 19; dropping it would leave the gain `
        + `untaxed entirely. Declare capitalGainsOrLosses on the return profile. `
        + `Nothing reaches ${destination}`,
})

// ── Form 4797 ────────────────────────────────────────────────────────────────

/**
 * Builds one printed line 2 / line 10 row from an asset and its disposal.
 *
 * Column (f) is *"Cost or other basis, plus improvements and expense of sale"*
 * and column (e) is *"Depreciation allowed or allowable since acquisition"*, so
 * column (g) — *"Subtract (f) from the sum of (d) and (e)"* — is written as the
 * printed sentence rather than as `price - adjustedBasis`.
 * @type {(asset: DepreciableAsset) => (disposal: AssetDisposal) => Form4797SaleRow}
 */
const saleRow = asset => disposal => {
    const depreciationAllowedCents = depreciationAllowedOrAllowableCents(asset)
    const costPlusExpenseOfSaleCents = asset.costOrOtherBasisCents + disposal.expenseOfSaleCents
    return {
        description: asset.description,
        dateAcquired: disposal.acquiredDate,
        dateSold: disposal.soldDate,
        grossSalesPriceCents: disposal.grossSalesPriceCents,
        depreciationAllowedCents,
        costPlusExpenseOfSaleCents,
        gainOrLossCents: disposal.grossSalesPriceCents + depreciationAllowedCents
            - costPlusExpenseOfSaleCents,
    }
}

/**
 * Builds one printed Part III property column.
 * @type {(section: 'section1245' | 'section1250') => (asset: DepreciableAsset) => (disposal: AssetDisposal) => Form4797PartIIIProperty}
 */
const partIIIProperty = section => asset => disposal => {
    // 20. "Gross sales price."
    const line20GrossSalesPriceCents = disposal.grossSalesPriceCents
    // 21. "Cost or other basis plus expense of sale."
    const line21CostPlusExpenseOfSaleCents = asset.costOrOtherBasisCents
        + disposal.expenseOfSaleCents
    // 22. "Depreciation (or depletion) allowed or allowable."
    const line22DepreciationCents = depreciationAllowedOrAllowableCents(asset)
    // 23. "Adjusted basis. Subtract line 22 from line 21."
    const line23AdjustedBasisCents = line21CostPlusExpenseOfSaleCents - line22DepreciationCents
    // 24. "Total gain. Subtract line 23 from line 20."
    const line24TotalGainCents = line20GrossSalesPriceCents - line23AdjustedBasisCents
    // 25a. "If section 1245 property: Depreciation allowed or allowable from
    //      line 22." Zero for §1250 property, because printed line 25's whole
    //      block is prefixed "If section 1245 property".
    const line25aCents = section === 'section1245' ? line22DepreciationCents : 0n
    // 25b. "Enter the smaller of line 24 or 25a." The cap is what makes a
    //      fully-recaptured machine reach line 32 = 0 and line 7 = 0.
    const line25bCents = section === 'section1245'
        ? (line24TotalGainCents < line25aCents ? line24TotalGainCents : line25aCents)
        : 0n
    // 26g. "Add lines 26b, 26e, and 26f." A structural zero — see this
    //      module's docstring: the register's §1250 classes are straight-line
    //      only and post-1986, which is i4797 p10's own exclusion, and §291 is
    //      corporations.
    const line26gCents = 0n
    // The Unrecaptured Section 1250 Gain Worksheet's lines 1-3, for this
    // property. Line 1 is "the smaller of line 22 or line 24", line 2 is
    // "the amount from Form 4797, line 26g", line 3 subtracts. §1245 property
    // has no entry: the worksheet's line 1 says "If you have a section 1250
    // property in Part III of Form 4797".
    const smallerOfTwentyTwoAndTwentyFour = line22DepreciationCents < line24TotalGainCents
        ? line22DepreciationCents
        : line24TotalGainCents
    const unrecapturedSectionTwelveFiftyGainCents = section === 'section1250'
        ? smallerOfTwentyTwoAndTwentyFour - line26gCents
        : 0n
    return {
        description: asset.description,
        dateAcquired: disposal.acquiredDate,
        dateSold: disposal.soldDate,
        line20GrossSalesPriceCents,
        line21CostPlusExpenseOfSaleCents,
        line22DepreciationCents,
        line23AdjustedBasisCents,
        line24TotalGainCents,
        line25aCents,
        line25bCents,
        line26gCents,
        unrecapturedSectionTwelveFiftyGainCents,
    }
}

/**
 * Computes Form 4797 for one return from the stored asset registers. Every
 * `const` below is one printed line, in printed order.
 * @type {(inputs: Form4797Inputs) => Form4797Outcome}
 */
export const formFortySevenNinetySeven = inputs => {
    const farmAccountNumbers = inputs.farmForms.map(farm => farm.value.accountNumber)
    /** @type {Form4797SaleRow[]} */
    const line2Rows = []
    /** @type {Form4797SaleRow[]} */
    const line10Rows = []
    /** @type {Form4797PartIIIProperty[]} */
    const partIIIProperties = []
    /** @type {Source[]} */
    const sources = []
    for (const register of inputs.assetRegisters) {
        for (const asset of depreciableAssets(register.value)) {
            const disposal = asset.disposal
            if (disposal === undefined) {
                continue
            }
            // Every refusal fires BEFORE any line is built, so a return
            // carrying one never produces a partial Form 4797 whose line 18b
            // is short by the refused disposal — `fjs/form4562`'s discipline.
            if (farmAccountNumbers.some(number => number === register.value.accountNumber)) {
                return farmDisposalRefusal(register.value.businessOrActivity)(
                    asset.description)(register.value.accountNumber)
            }
            const section = sectionOfClassification(asset.classification)
            if (section === undefined) {
                return ambiguousSectionRefusal(asset.description)(asset.classification)
            }
            if (asset.businessUseHundredthsOfPercent !== fullBusinessUseHundredths) {
                return partialBusinessUseRefusal(asset.description)(
                    asset.businessUseHundredthsOfPercent)
            }
            sources.push({
                documentHash: register.documentHash,
                boxPath: `assets -> ${JSON.stringify(asset.description)} -> disposal`,
                value: centsToString(disposal.grossSalesPriceCents),
            })
            // i4797 p1's chart, the two rows this engine serves. "Held 1 year
            // or less" is Part II whether it is a gain or a loss; held more
            // than a year is Part III at a gain and Part I at a loss, for both
            // §1245 and §1250 property.
            const row = saleRow(asset)(disposal)
            if (!heldMoreThanOneYear(disposal)) {
                line10Rows.push(row)
                continue
            }
            if (row.gainOrLossCents <= 0n) {
                line2Rows.push(row)
                continue
            }
            partIIIProperties.push(partIIIProperty(section)(asset)(disposal))
        }
    }

    // ── Part III summary, lines 30-32 (computed first: line 6 takes line 32
    //    and line 13 takes line 31) ────────────────────────────────────────
    // 30. "Total gains for all properties. Add property columns A through D,
    //     line 24."
    const line30Cents = partIIIProperties.reduce((sum, p) => sum + p.line24TotalGainCents, 0n)
    // 31. "Add property columns A through D, lines 25b, 26g, 27c, 28b, and
    //     29b. Enter here and on line 13." Lines 27c (§1252 farmland), 28b
    //     (§1254 mineral property) and 29b (§1255 cost-sharing property) are
    //     structural zeros: no dialect can spell any of the three, and a
    //     register bound to a farm refuses above.
    const line31Cents = partIIIProperties.reduce(
        (sum, p) => sum + p.line25bCents + p.line26gCents, 0n)
    // 32. "Subtract line 31 from line 30. Enter the portion from casualty or
    //     theft on Form 4684, line 33. Enter the portion from other than
    //     casualty or theft on Form 4797, line 6." Every disposal this engine
    //     can spell is a sale, so the whole of line 32 is the second portion.
    const line32Cents = line30Cents - line31Cents

    // ── Part I ──────────────────────────────────────────────────────────────
    // 1a. "Enter the gross proceeds from sales or exchanges reported to you for
    //     2025 on Form(s) 1099-B or 1099-S … that you are including on line 2,
    //     10, or 20." A documented zero with two reasons: no `vnd.fjs.1099s`
    //     dialect exists, and the 1099-B half is the mark-to-market trader's
    //     line 10 (i4797 p5), which `straddleGainsAndLosses` refuses.
    const line1aCents = 0n
    // 1b, 1c. Gains and losses "due to the partial dispositions of MACRS
    //     assets". Documented zeros: a `disposal` block disposes of a whole
    //     registered asset, and a partial disposition — Reg. §1.168(i)-8(d) —
    //     cannot be spelled at all, elective or required.
    const line1bCents = 0n
    const line1cCents = 0n
    // 3. "Gain, if any, from Form 4684, line 39." Documented zero: no Form
    //    4684, which `otherGainsOrLosses`' own remedy names.
    const line3Cents = 0n
    // 4. "Section 1231 gain from installment sales from Form 6252, line 26 or
    //    37." Documented zero: no Form 6252.
    const line4Cents = 0n
    // 5. "Section 1231 gain or (loss) from like-kind exchanges from Form 8824."
    //    Documented zero: no Form 8824.
    const line5Cents = 0n
    // 6. "Gain, if any, from line 32, from other than casualty or theft."
    const line6Cents = line32Cents
    // 7. "Combine lines 2 through 6."
    const line7Cents = line2Rows.reduce((sum, r) => sum + r.gainOrLossCents, 0n)
        + line3Cents + line4Cents + line5Cents + line6Cents

    const filed = sources.length !== 0
    const certified
        = inputs.profile.value.noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears === true
    const filingScheduleD = inputs.profile.value.declaredKinds.some(
        kind => kind === 'capitalGainsOrLosses')
    if (line7Cents > 0n) {
        if (!certified) {
            return sectionTwelveThirtyOneLookbackRefusal(line7Cents)
        }
        if (!filingScheduleD) {
            return scheduleDNotFiledRefusal(line7Cents)
        }
    }
    // 8. "Nonrecaptured net section 1231 losses from prior years." Zero in
    //    every computable return, by two different routes, and the pair is
    //    the whole §1231 design: a line 7 that is zero or a loss SKIPS this
    //    line by printed instruction, and a line 7 that is a gain reaches it
    //    only on the certification that it is empty. It is a field rather
    //    than a comment because i1040sd p.12's worksheet line 8 reads it by
    //    name — "Enter the amount, if any, from Form 4797, line 8".
    const line8Cents = 0n
    // 9. "Subtract line 8 from line 7. If zero or less, enter -0-."
    const line9Cents = line7Cents - line8Cents > 0n ? line7Cents - line8Cents : 0n
    // The printed instruction under line 7, for a gain with no prior-year
    // §1231 losses: "enter the gain from line 7 as a long-term capital gain on
    // the Schedule D filed with your return and skip lines 8, 9, 11, and 12."
    // So a gain leaves through Schedule D and lines 11 and 12 stay blank; a
    // loss goes to line 11 and Schedule D gets nothing.
    const isGain = line7Cents > 0n
    const longTermCapitalGainCents = isGain ? line7Cents : 0n

    // ── Part II ─────────────────────────────────────────────────────────────
    // 11. "Loss, if any, from line 7" — printed inside parentheses, so a
    //     negative here.
    const line11Cents = line7Cents < 0n ? line7Cents : 0n
    // 12. "Gain, if any, from line 7 or amount from line 8, if applicable."
    //     Skipped in both computable branches: a loss year has no gain, and a
    //     gain year is told to "skip lines 8, 9, 11, and 12".
    const line12Cents = 0n
    // 13. "Gain, if any, from line 31."
    const line13Cents = line31Cents
    // 14. "Net gain or (loss) from Form 4684, lines 31 and 38a." Documented 0.
    const line14Cents = 0n
    // 15. "Ordinary gain from installment sales from Form 6252, line 25 or 36."
    const line15Cents = 0n
    // 16. "Ordinary gain or (loss) from like-kind exchanges from Form 8824."
    const line16Cents = 0n
    // 17. "Combine lines 10 through 16."
    const line17Cents = line10Rows.reduce((sum, r) => sum + r.gainOrLossCents, 0n)
        + line11Cents + line12Cents + line13Cents + line14Cents + line15Cents + line16Cents
    // 18a. i4797 p8: "You must complete this line if there is a gain on Form
    //      4797, line 3; a loss on Form 4797, line 11; and a loss on Form 4684,
    //      line 35, column (b)(ii)." A STRUCTURAL zero, not a documented one:
    //      line 3 is zero in every computable return, so the first of the three
    //      conditions can never hold.
    const line18aCents = 0n
    // 18b. "Redetermine the gain or (loss) on line 17 excluding the loss, if
    //      any, on line 18a. Enter here and on Schedule 1 (Form 1040), Part I,
    //      line 4."
    const line18bCents = line17Cents - line18aCents

    return {
        kind: 'ok',
        filed,
        line1aCents, line1bCents, line1cCents,
        line2Rows,
        line3Cents, line4Cents, line5Cents, line6Cents, line7Cents,
        line8Cents, line9Cents,
        line10Rows,
        line11Cents, line12Cents, line13Cents, line14Cents, line15Cents, line16Cents,
        line17Cents, line18aCents, line18bCents,
        partIIIProperties,
        line30Cents, line31Cents, line32Cents,
        longTermCapitalGainCents,
        unrecapturedSectionTwelveFiftyGainCents: partIIIProperties.reduce(
            (sum, p) => sum + p.unrecapturedSectionTwelveFiftyGainCents, 0n),
        sources,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * A return profile. `declaredKinds` and the §1231 certification are the two
 * things this form reads off it, so both are parameters and every case says
 * what it means about each.
 * @type {(declaredKinds: readonly string[]) => (certified: boolean) => Stored<ReturnProfile>}
 */
const profileDocument = declaredKinds => certified => ({
    documentHash: 'sha256-profile',
    value: {
        dialect: 'vnd.fjs.return_profile',
        taxYear: 2025,
        filingStatus: 'single',
        dependentCount: 0,
        declaredKinds,
        ...(certified
            ? {
                noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears:
                    /** @type {true} */ (true),
            }
            : {}),
    },
})

/** The ordinary profile: capital gains declared, and the lookback certified empty. */
const fullyDeclaredProfile = profileDocument(['otherGainsOrLosses', 'capitalGainsOrLosses'])(true)

/** @type {(accountNumber: string) => (assets: readonly RegisteredAsset[]) => Stored<AssetRegister>} */
const registerDocument = accountNumber => assets => ({
    documentHash: `sha256-register-${accountNumber}`,
    value: {
        dialect: 'vnd.fjs.asset_register',
        recipientTin: '222-22-2222',
        accountNumber,
        taxYear: 2025,
        businessOrActivity: `activity ${accountNumber}`,
        everyDepreciableAssetIsListed: true,
        priorYearSection179CarryoverIsZero: true,
        assets,
    },
})

/**
 * **Asset A — a lathe, §1245, sold at a gain that §1245 recaptures ENTIRELY.**
 * The ordinary equipment case, and the one that makes line 7 exactly zero.
 *
 * 7-year property, 200 DB, half-year, placed in service March 2022, cost
 * $20,001.00 at 100% business use, no §168(k). Acquired 10 February 2022 and
 * sold 14 August 2025 for $9,000.00 with $250.00 of selling expense.
 *
 * The basis is $20,001.00 rather than $20,000.00 on purpose: every printed
 * Table A-1 percentage divides $20,000.00 exactly, and AGENTS.md records a
 * rounding mutation surviving a whole fixture set for that reason.
 * @type {RegisteredAsset}
 */
const lathe = {
    description: 'lathe',
    datePlacedInService: '2022-03',
    costOrOtherBasis: '20001.00',
    businessUsePercentage: '100.00',
    classification: 'sevenYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
    disposal: {
        dateAcquired: '2022-02-10',
        dateSold: '2025-08-14',
        grossSalesPrice: '9000.00',
        expenseOfSale: '250.00',
    },
}

/**
 * **Asset B — a delivery trailer, §1245, sold for MORE than it cost.** Line 24
 * exceeds line 25a, so line 25b is a genuine `min` and line 32 is positive —
 * the only shape in which `min(line 24, line 25a)` is observable as a `min` at
 * all, and therefore the only fixture that can redden a mutation deleting it.
 *
 * 5-year property, 200 DB, **mid-quarter**, placed in service November 2023
 * (fourth quarter) and sold in May 2025 (**second** quarter). The two quarters
 * differ so that feeding the placed-in-service month to Step 3's disposal
 * column — 0.125 instead of 0.375 — is visible.
 * @type {RegisteredAsset}
 */
const trailer = {
    description: 'delivery trailer',
    datePlacedInService: '2023-11',
    costOrOtherBasis: '8001.00',
    businessUsePercentage: '100.00',
    classification: 'fiveYear',
    method: '200DB',
    convention: 'MQ',
    section168kStatus: 'electedOut',
    disposal: {
        dateAcquired: '2023-10-05',
        dateSold: '2025-05-20',
        grossSalesPrice: '9500.00',
        expenseOfSale: '100.00',
    },
}

/**
 * **Asset C — an office desk sold at a LOSS after more than a year.** Lands in
 * Part I line 2 rather than Part III, per i4797 p1's chart: *"Depreciable
 * tangible trade or business property … Sold or exchanged at a loss … Part
 * I."*
 * @type {RegisteredAsset}
 */
const desk = {
    description: 'office desk',
    datePlacedInService: '2021-09',
    costOrOtherBasis: '6000.00',
    businessUsePercentage: '100.00',
    classification: 'sevenYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
    disposal: {
        dateAcquired: '2021-09-02',
        dateSold: '2025-03-11',
        grossSalesPrice: '500.00',
        expenseOfSale: '0.00',
    },
}

/**
 * **Asset D — a residential rental duplex, §1250, sold at a gain.** Line 26g is
 * zero and the unrecaptured §1250 gain is not, which is the whole point of
 * separating them.
 *
 * 27.5-year residential rental, straight line, **mid-month**, placed in service
 * April 2019 and sold October 2025 — a different month on each side, so the
 * mid-month disposal decimal (19/24) cannot be confused with the
 * placed-in-service one (17/24).
 * @type {RegisteredAsset}
 */
const duplex = {
    description: 'rental duplex',
    datePlacedInService: '2019-04',
    costOrOtherBasis: '200555.00',
    businessUsePercentage: '100.00',
    classification: 'residentialRental',
    method: 'SL',
    convention: 'MM',
    section168kStatus: 'electedOut',
    disposal: {
        dateAcquired: '2019-03-15',
        dateSold: '2025-10-07',
        grossSalesPrice: '250000.00',
        expenseOfSale: '6000.00',
    },
}

/**
 * **Asset E — a forklift held ONE YEAR OR LESS.** Acquired 20 August 2024 and
 * sold 30 June 2025, so it lands in Part II whether it is a gain or a loss —
 * and it is a gain, so the routing cannot be confused with "losses go to Part
 * II".
 * @type {RegisteredAsset}
 */
const forklift = {
    description: 'forklift',
    datePlacedInService: '2024-08',
    costOrOtherBasis: '12000.00',
    businessUsePercentage: '100.00',
    classification: 'fiveYear',
    method: '200DB',
    convention: 'HY',
    section168kStatus: 'electedOut',
    disposal: {
        dateAcquired: '2024-08-20',
        dateSold: '2025-06-30',
        grossSalesPrice: '9000.00',
        expenseOfSale: '0.00',
    },
}

/** @type {(outcome: Form4797Outcome) => Form4797Ok} */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 4797 to compute', outcome])
    if (outcome.kind !== 'ok') { throw ['expected ok', outcome] }
    return outcome
}

/** @type {(outcome: Form4797Outcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 4797 to refuse', outcome])
    if (outcome.kind !== 'error') { throw ['expected error', outcome] }
    // Every refusal must say WHERE the amount would have gone, and the three
    // destinations are what a reader can act on. AGENTS.md records a
    // verification sweep in which erasing a destination from an interpolation
    // survived the whole suite because five refusal proofs asserted the box
    // name and none asserted the destination.
    assert(outcome.message.includes('Schedule 1 line 4'),
        ['the refusal must name the ordinary destination', outcome.message])
    assert(outcome.message.includes('Schedule D line 11'),
        ['the refusal must name the §1231 destination', outcome.message])
    assert(outcome.message.includes('Schedule D line 19'),
        ['the refusal must name the 25%-rate destination', outcome.message])
    return outcome.message
}

/** Runs the form over one register on the fully-declared profile. @type {(assets: readonly RegisteredAsset[]) => Form4797Outcome} */
const overOneRegister = assets => formFortySevenNinetySeven({
    profile: fullyDeclaredProfile,
    assetRegisters: [registerDocument('BUS-0001')(assets)],
    farmForms: [],
})

/**
 * A farm whose `accountNumber` is what binds a register to it — the identical
 * match `fjs/schedule/f` makes.
 * @type {(accountNumber: string) => Stored<Farm>}
 */
const farmDocument = accountNumber => ({
    documentHash: 'sha256-farm',
    value: {
        dialect: 'vnd.fjs.farm',
        recipientTin: '222-22-2222',
        accountNumber,
        taxYear: 2025,
        principalCropOrActivity: 'corn and soybeans',
        accountingMethod: 'cash',
        materiallyParticipated: 'yes',
        investmentAtRisk: 'allAtRisk',
        salesOfRaisedProductsAndLivestock: '142600.00',
        cropInsuranceProceedsDeferredFromPriorYear: '0.00',
        entries: [],
    },
})

export const proof = {
    /**
     * The three characterization lists PARTITION the eight MACRS
     * classifications: every one is §1245, §1250 or refused, and none is two
     * of those. Hand-typed sizes beside the walk, in
     * `expectedClassificationCount`'s idiom — a name deleted from a list would
     * otherwise vanish from the walk in the same instant and lose coverage
     * silently, which is AGENTS.md's fourth shipped defect.
     */
    everyClassificationIsCharacterizedExactlyOnce: () => {
        assertEq(sectionTwelveFortyFiveClassifications.length, expectedSectionTwelveFortyFiveCount)
        assertEq(sectionTwelveFiftyClassifications.length, expectedSectionTwelveFiftyCount)
        assertEq(straddlingClassifications.length, expectedStraddlingCount)
        assertEq(
            expectedSectionTwelveFortyFiveCount + expectedSectionTwelveFiftyCount
            + expectedStraddlingCount,
            expectedClassificationCount,
            'the three lists must cover the whole MACRS vocabulary')
        for (const name of macrsClassificationNames) {
            const found = [
                sectionTwelveFortyFiveClassifications.some(c => c === name),
                sectionTwelveFiftyClassifications.some(c => c === name),
                straddlingClassifications.some(c => c === name),
            ].filter(present => present)
            assertEq(found.length, 1, `${name} must appear in exactly one list`)
        }
        // And the function agrees with the lists, in all three directions.
        assertEq(sectionOfClassification('sevenYear'), 'section1245')
        assertEq(sectionOfClassification('residentialRental'), 'section1250')
        assertEq(sectionOfClassification('fifteenYear'), undefined)
    },
    holdingPeriod: {
        /**
         * i4797 p6: *"begin counting on the day after you received the
         * property and include the day you disposed of it."* So exactly one
         * year is NOT more than one year, and one day later is.
         *
         * Both leaves matter: a `>=` here would move the boundary date from
         * Part II to Part III for a §1245 gain, which is the difference
         * between an ordinary recapture and a §1231 gain.
         */
        exactlyOneYearIsNotMoreThanOneYear: () => {
            assertEq(heldMoreThanOneYear({
                acquiredDate: '2024-06-15', soldDate: '2025-06-15',
                soldYear: 2025, soldMonth: 6, grossSalesPriceCents: 0n, expenseOfSaleCents: 0n,
            }), false)
            assertEq(heldMoreThanOneYear({
                acquiredDate: '2024-06-15', soldDate: '2025-06-16',
                soldYear: 2025, soldMonth: 6, grossSalesPriceCents: 0n, expenseOfSaleCents: 0n,
            }), true)
        },
        /**
         * The leap-day boundary, where a "365 days later" test is wrong.
         * Acquired 29 February 2024, the holding period begins 1 March 2024
         * and one full year of it completes at the end of 28 February 2025 —
         * so 1 March 2025 is more than a year and 28 February 2025 is not.
         * The comparison reaches those answers through `'2025-02-29'`, a date
         * that does not exist, because only the ORDER is ever used.
         */
        theLeapDayBoundary: () => {
            assertEq(heldMoreThanOneYear({
                acquiredDate: '2024-02-29', soldDate: '2025-03-01',
                soldYear: 2025, soldMonth: 3, grossSalesPriceCents: 0n, expenseOfSaleCents: 0n,
            }), true)
            assertEq(heldMoreThanOneYear({
                acquiredDate: '2024-02-29', soldDate: '2025-02-28',
                soldYear: 2025, soldMonth: 2, grossSalesPriceCents: 0n, expenseOfSaleCents: 0n,
            }), false)
        },
        /**
         * The YEAR is what advances, not the month or the day: a sale ten
         * months later in a LATER calendar year is still one year or less.
         * Without this leaf a `soldDate > acquiredDate` with no year
         * arithmetic at all passes both leaves above.
         */
        aLaterCalendarYearIsNotAYearLater: () => {
            assertEq(heldMoreThanOneYear({
                acquiredDate: '2024-08-20', soldDate: '2025-06-30',
                soldYear: 2025, soldMonth: 6, grossSalesPriceCents: 0n, expenseOfSaleCents: 0n,
            }), false)
        },
    },
    /**
     * **Asset A alone, worked line by line in integer cents from the printed
     * pages**, and it is the case that makes line 7 exactly zero.
     *
     * ```
     *   Publication 946 Table A-1, 7-year, half-year: 14.29 24.49 17.49 12.49
     *   basis $20,001.00 = 2,000,100 cents, recovery years 2022..2025
     *   y1  14.29% x 2,000,100 =   285,814.29 ->   285,814
     *   y2  24.49% x 2,000,100 =   489,824.49 ->   489,824
     *   y3  17.49% x 2,000,100 =   349,817.49 ->   349,817
     *   y4  12.49% x 2,000,100 x 0.5 = 124,906.245 -> 124,906  (i4562 Step 3, HY disposal)
     *   22  depreciation allowed or allowable    1,250,361
     *   21  2,000,100 + 25,000                   2,025,100
     *   23  2,025,100 - 1,250,361                  774,739
     *   24  900,000 - 774,739                      125,261
     *   25a line 22                              1,250,361
     *   25b min(125,261, 1,250,361)                125,261   <- the cap binds
     *   30  125,261     31  125,261     32  0
     *    6  0            7  0
     *   13  125,261     17  125,261    18b  125,261
     * ```
     */
    aFullyRecapturedSectionTwelveFortyFiveGain: () => {
        const f = expectOk(overOneRegister([lathe]))
        assertEq(f.filed, true)
        assertEq(f.partIIIProperties.length, 1)
        const [property] = f.partIIIProperties
        assert(property !== undefined, 'expected one Part III property')
        if (property === undefined) { return }
        assertEq(property.line22DepreciationCents, 1250361n, 'line 22')
        assertEq(property.line21CostPlusExpenseOfSaleCents, 2025100n, 'line 21')
        assertEq(property.line23AdjustedBasisCents, 774739n, 'line 23')
        assertEq(property.line24TotalGainCents, 125261n, 'line 24')
        assertEq(property.line25aCents, 1250361n, 'line 25a')
        assertEq(property.line25bCents, 125261n, 'line 25b — the smaller of line 24 or 25a')
        assertEq(property.line26gCents, 0n, 'line 26g — §1245 property has no §1250 block')
        assertEq(property.unrecapturedSectionTwelveFiftyGainCents, 0n,
            'the 25% rate is a §1250 figure, and this is §1245 property')
        assertEq(f.line30Cents, 125261n)
        assertEq(f.line31Cents, 125261n)
        assertEq(f.line32Cents, 0n, 'nothing is left once §1245 has recaptured')
        assertEq(f.line6Cents, 0n)
        assertEq(f.line7Cents, 0n, 'and THIS is why the five-year lookback is never reached')
        assertEq(f.line13Cents, 125261n)
        assertEq(f.line17Cents, 125261n)
        assertEq(f.line18bCents, 125261n, 'the whole gain is ordinary, on Schedule 1 line 4')
        assertEq(f.longTermCapitalGainCents, 0n)
    },
    /**
     * **The line 7 = 0 case needs NO certification**, because the printed
     * instruction says *"If line 7 is zero or a loss … skip lines 8 and 9."*
     * The control that makes the lookback refusal a statement about GAINS
     * rather than about disposals.
     */
    aFullyRecapturedGainNeedsNoLookbackCertification: () => {
        const f = expectOk(formFortySevenNinetySeven({
            profile: profileDocument(['otherGainsOrLosses'])(false),
            assetRegisters: [registerDocument('BUS-0001')([lathe])],
            farmForms: [],
        }))
        assertEq(f.line7Cents, 0n)
        assertEq(f.line18bCents, 125261n)
    },
    /**
     * **Asset B alone: the gain EXCEEDS the depreciation, so line 25b is a real
     * `min` and line 32 is positive.**
     *
     * ```
     *   Table A-5 (mid-quarter, 4th quarter), 5-year: 5.00 38.00 22.80
     *   basis $8,001.00 = 800,100 cents, recovery years 2023..2025
     *   y1   5.00% x 800,100 =  40,005
     *   y2  38.00% x 800,100 = 304,038
     *   y3  22.80% x 800,100 x 0.375 = 68,408.55 -> 68,409
     *          0.375 is Step 3's SECOND-quarter DISPOSAL decimal (sold in May)
     *   22  412,452     21  800,100 + 10,000 = 810,100
     *   23  810,100 - 412,452 = 397,648
     *   24  950,000 - 397,648 = 552,352
     *   25b min(552,352, 412,452) = 412,452     32  552,352 - 412,452 = 139,900
     *    6  139,900     7  139,900   <- a §1231 GAIN
     *   13  412,452     17  412,452   18b  412,452
     * ```
     */
    aSectionTwelveFortyFiveGainLargerThanTheDepreciation: () => {
        const f = expectOk(overOneRegister([trailer]))
        const [property] = f.partIIIProperties
        assert(property !== undefined, 'expected one Part III property')
        if (property === undefined) { return }
        assertEq(property.line22DepreciationCents, 412452n, 'line 22')
        assertEq(property.line23AdjustedBasisCents, 397648n, 'line 23')
        assertEq(property.line24TotalGainCents, 552352n, 'line 24')
        assertEq(property.line25bCents, 412452n, 'line 25b caps at the depreciation')
        assertEq(f.line32Cents, 139900n, 'the excess over the recapture')
        assertEq(f.line7Cents, 139900n)
        assertEq(f.line18bCents, 412452n, 'the recaptured half is ordinary')
        assertEq(f.longTermCapitalGainCents, 139900n, 'and the excess is a §1231 gain')
    },
    /**
     * **Asset C alone: a LOSS after more than a year lands in Part I, and the
     * whole return computes with NO certification.** The asymmetry, in one
     * leaf.
     *
     * ```
     *   Table A-1, 7-year, half-year, basis $6,000.00, recovery years 2021..2025
     *   y1 85,740  y2 146,940  y3 104,940  y4 74,940
     *   y5  8.93% x 600,000 x 0.5 = 26,790
     *   col (e) 439,350   col (f) 600,000
     *   col (g) 50,000 + 439,350 - 600,000 = -110,650
     *    7  -110,650     11  -110,650     17  -110,650     18b  -110,650
     * ```
     */
    aSectionTwelveThirtyOneLossComputesWithoutAnyPriorYearFigure: () => {
        const f = expectOk(formFortySevenNinetySeven({
            profile: profileDocument(['otherGainsOrLosses'])(false),
            assetRegisters: [registerDocument('BUS-0001')([desk])],
            farmForms: [],
        }))
        assertEq(f.partIIIProperties.length, 0, 'a loss never reaches Part III')
        assertEq(f.line2Rows.length, 1)
        const [row] = f.line2Rows
        assert(row !== undefined, 'expected one Part I row')
        if (row === undefined) { return }
        assertEq(row.depreciationAllowedCents, 439350n, 'column (e)')
        assertEq(row.costPlusExpenseOfSaleCents, 600000n, 'column (f)')
        assertEq(row.gainOrLossCents, -110650n, 'column (g)')
        assertEq(f.line7Cents, -110650n)
        assertEq(f.line11Cents, -110650n, 'printed inside parentheses: a negative')
        assertEq(f.line12Cents, 0n)
        assertEq(f.line17Cents, -110650n)
        assertEq(f.line18bCents, -110650n, 'a fully ordinary loss, on Schedule 1 line 4')
        assertEq(f.longTermCapitalGainCents, 0n, 'and nothing reaches Schedule D')
    },
    /**
     * **Asset D alone: §1250 property at a gain.** Line 26g is zero because
     * i4797 p10 excludes post-1986 straight-line MACRS real property from §1250
     * recapture — and the unrecaptured §1250 gain §1(h)(1)(E) taxes at 25% is
     * $47,400.18, which is emphatically not zero.
     *
     * ```
     *   Table A-6, 27.5-year mid-month, placed in service month 4:
     *     y1 2.576%, y2..y7 3.636%     basis $200,555.00 = 20,055,500 cents
     *   y1  2.576% x 20,055,500 =   516,629.68 ->   516,630
     *   y2..y6 (five years) 3.636% x 20,055,500 = 729,217.98 -> 729,218 = 3,646,090
     *   y7  729,217.98 x 19/24 = 577,297.5675 -> 577,298
     *          19/24 is Step 3's MM disposal decimal for month 10
     *   22  4,740,018    21  20,055,500 + 600,000 = 20,655,500
     *   23  15,915,482   24  25,000,000 - 15,915,482 = 9,084,518
     *   25a 0   25b 0   26g 0
     *   unrecaptured §1250 = min(22, 24) - 26g = 4,740,018
     *   30  9,084,518   31  0   32  9,084,518    7  9,084,518
     *   13  0   17  0   18b  0
     * ```
     */
    aSectionTwelveFiftyGainRecapturesNothingAndStillCarriesAQuarterRateFigure: () => {
        const f = expectOk(overOneRegister([duplex]))
        const [property] = f.partIIIProperties
        assert(property !== undefined, 'expected one Part III property')
        if (property === undefined) { return }
        assertEq(property.line22DepreciationCents, 4740018n, 'line 22')
        assertEq(property.line23AdjustedBasisCents, 15915482n, 'line 23')
        assertEq(property.line24TotalGainCents, 9084518n, 'line 24')
        assertEq(property.line25aCents, 0n, 'line 25 is prefixed "If section 1245 property"')
        assertEq(property.line25bCents, 0n)
        assertEq(property.line26gCents, 0n,
            'i4797 p10: §1250 recapture "does not apply" to post-1986 S/L MACRS real property')
        assertEq(property.unrecapturedSectionTwelveFiftyGainCents, 4740018n,
            'and THAT is what §1(h)(1)(E) taxes at up to 25%')
        assertEq(f.line31Cents, 0n, 'nothing is ordinary')
        assertEq(f.line18bCents, 0n)
        assertEq(f.line7Cents, 9084518n)
        assertEq(f.longTermCapitalGainCents, 9084518n)
        assertEq(f.unrecapturedSectionTwelveFiftyGainCents, 4740018n)
    },
    /**
     * **Asset E alone: held ONE YEAR OR LESS, so Part II — and it is a GAIN.**
     * i4797 p1's chart puts *"Depreciable tangible trade or business property …
     * Sold or exchanged at a gain … Held 1 year or less … Part II"*, so the
     * routing cannot be read as "losses go to Part II".
     *
     * ```
     *   Table A-1, 5-year, half-year: 20.00 32.00      basis $12,000.00
     *   y1 240,000    y2 32.00% x 1,200,000 x 0.5 = 192,000
     *   col (e) 432,000  col (f) 1,200,000
     *   col (g) 900,000 + 432,000 - 1,200,000 = 132,000
     *   10 132,000    17 132,000    18b 132,000     7 0
     * ```
     */
    aShortHoldingPeriodGainIsOrdinaryInPartTwo: () => {
        const f = expectOk(formFortySevenNinetySeven({
            profile: profileDocument(['otherGainsOrLosses'])(false),
            assetRegisters: [registerDocument('BUS-0001')([forklift])],
            farmForms: [],
        }))
        assertEq(f.partIIIProperties.length, 0, 'one year or less never reaches Part III')
        assertEq(f.line2Rows.length, 0, 'nor Part I')
        assertEq(f.line10Rows.length, 1)
        const [row] = f.line10Rows
        assert(row !== undefined, 'expected one Part II row')
        if (row === undefined) { return }
        assertEq(row.depreciationAllowedCents, 432000n, 'column (e)')
        assertEq(row.gainOrLossCents, 132000n, 'column (g) — a GAIN, and still Part II')
        assertEq(f.line7Cents, 0n)
        assertEq(f.line17Cents, 132000n)
        assertEq(f.line18bCents, 132000n)
    },
    /**
     * **All five assets, across TWO registers.** One Form 4797 is filed per
     * return however many businesses it covers, and the netting is where a
     * sign error survives every single-asset leaf:
     *
     * ```
     *   Part III  A 24=125,261 25b=125,261 | B 24=552,352 25b=412,452
     *             D 24=9,084,518 25b=0 26g=0
     *   30  125,261 + 552,352 + 9,084,518 = 9,762,131
     *   31  125,261 + 412,452 + 0         =   537,713
     *   32  9,762,131 - 537,713           = 9,224,418   -> line 6
     *   Part I    C column (g) = -110,650
     *    7  -110,650 + 9,224,418          = 9,113,768   <- a GAIN
     *   Part II   E column (g) = 132,000
     *   11  0 (line 7 is a gain)   12  0   13  537,713
     *   17  132,000 + 537,713             =   669,713   -> 18b
     *   unrecaptured §1250 = 4,740,018 (asset D alone)
     * ```
     *
     * The Part I loss is what makes this more than five independent sums: it is
     * NEGATIVE and it nets against the Part III excess before line 7's sign is
     * decided.
     */
    fiveDisposalsAcrossTwoRegistersNetIntoThreeAnswers: () => {
        const f = expectOk(formFortySevenNinetySeven({
            profile: fullyDeclaredProfile,
            assetRegisters: [
                registerDocument('BUS-0001')([lathe, trailer, desk, forklift]),
                registerDocument('RENT-0002')([duplex]),
            ],
            farmForms: [],
        }))
        assertEq(f.partIIIProperties.length, 3)
        assertEq(f.line2Rows.length, 1)
        assertEq(f.line10Rows.length, 1)
        assertEq(f.line30Cents, 9762131n, 'line 30')
        assertEq(f.line31Cents, 537713n, 'line 31')
        assertEq(f.line32Cents, 9224418n, 'line 32')
        assertEq(f.line6Cents, 9224418n)
        assertEq(f.line7Cents, 9113768n, 'the Part I LOSS nets against the Part III excess')
        assertEq(f.line11Cents, 0n, 'a gain year skips lines 11 and 12')
        assertEq(f.line12Cents, 0n)
        assertEq(f.line13Cents, 537713n)
        assertEq(f.line17Cents, 669713n)
        assertEq(f.line18bCents, 669713n)
        assertEq(f.longTermCapitalGainCents, 9113768n)
        assertEq(f.unrecapturedSectionTwelveFiftyGainCents, 4740018n)
        assertEq(f.sources.length, 5, 'one citation per disposal, across both registers')
    },
    /**
     * A return with registers but no disposals is not a Form 4797 at all.
     * `filed` is what a caller uses to print Schedule 1 line 4 as a
     * profile-declared zero rather than a computed one.
     */
    aRegisterWithNoDisposalsFilesNothing: () => {
        const f = expectOk(overOneRegister([{ ...lathe, disposal: undefined }]))
        assertEq(f.filed, false)
        assertEq(f.sources.length, 0)
        assertEq(f.line7Cents, 0n)
        assertEq(f.line18bCents, 0n)
    },
    /** Every documented and structural zero, asserted rather than assumed. */
    theDocumentedAndStructuralZeros: () => {
        const f = expectOk(overOneRegister([lathe]))
        assertEq(f.line1aCents, 0n, '1099-B/1099-S gross proceeds: no vnd.fjs.1099s dialect')
        assertEq(f.line1bCents, 0n, 'partial dispositions of MACRS assets cannot be spelled')
        assertEq(f.line1cCents, 0n)
        assertEq(f.line3Cents, 0n, 'Form 4684')
        assertEq(f.line4Cents, 0n, 'Form 6252')
        assertEq(f.line5Cents, 0n, 'Form 8824')
        assertEq(f.line8Cents, 0n, 'skipped when line 7 is zero or a loss, certified when a gain')
        assertEq(f.line14Cents, 0n, 'Form 4684')
        assertEq(f.line15Cents, 0n, 'Form 6252')
        assertEq(f.line16Cents, 0n, 'Form 8824')
        // Line 18a is STRUCTURAL, not documented: i4797 p8 requires a gain on
        // line 3 as one of its three conditions, and line 3 is zero above.
        assertEq(f.line18aCents, 0n)
    },
    refusals: {
        /**
         * **R4, the §1231 lookback.** A GAIN on line 7 with no certification
         * refuses AT PRINTED LINE 8, naming the five preceding years.
         */
        aGainWithoutTheLookbackCertificationIsRefused: () => {
            const message = expectRefusal(formFortySevenNinetySeven({
                profile: profileDocument(['otherGainsOrLosses', 'capitalGainsOrLosses'])(false),
                assetRegisters: [registerDocument('BUS-0001')([trailer])],
                farmForms: [],
            }))
            assert(message.includes('line 8'), ['the refusal must name the printed line', message])
            assert(message.includes('5 preceding tax years'),
                ['the refusal must quote the printed definition', message])
            assert(message.includes('1399.00'),
                ['the refusal must quote the gain that cannot be characterized', message])
            assert(message.includes('UNDERSTATES'),
                ['the refusal must name the direction of the error', message])
        },
        /**
         * **THE CONTROL, and it is the whole design in two leaves**: the same
         * uncertified profile computes when the disposal is a LOSS. So the
         * refusal is about §1231 GAINS, not about disposals.
         */
        theSameProfileComputesALoss: () => {
            const f = expectOk(formFortySevenNinetySeven({
                profile: profileDocument(['otherGainsOrLosses', 'capitalGainsOrLosses'])(false),
                assetRegisters: [registerDocument('BUS-0001')([desk])],
                farmForms: [],
            }))
            assertEq(f.line7Cents, -110650n)
        },
        /** THE SECOND CONTROL: with the certification, the same gain computes. */
        theSameGainComputesOnceCertified: () => {
            const f = expectOk(overOneRegister([trailer]))
            assertEq(f.line7Cents, 139900n)
            assertEq(f.longTermCapitalGainCents, 139900n)
        },
        /**
         * **R5.** A §1231 gain on a return that declares no capital gains has
         * nowhere to land: printed line 7 sends it *"as a long-term capital
         * gain on the Schedule D filed with your return"*, and there is none.
         */
        aGainWithNoScheduleDIsRefused: () => {
            const message = expectRefusal(formFortySevenNinetySeven({
                profile: profileDocument(['otherGainsOrLosses'])(true),
                assetRegisters: [registerDocument('BUS-0001')([trailer])],
                farmForms: [],
            }))
            assert(message.includes('capitalGainsOrLosses'),
                ['the refusal must name the kind to declare', message])
            assert(message.includes('untaxed entirely'),
                ['the refusal must say what dropping it would cost', message])
        },
        /**
         * THE CONTROL: the same undeclared profile computes a line 7 of zero,
         * because a fully-recaptured §1245 gain never needs a Schedule D.
         */
        theSameUndeclaredProfileComputesAFullyRecapturedGain: () => {
            const f = expectOk(formFortySevenNinetySeven({
                profile: profileDocument(['otherGainsOrLosses'])(true),
                assetRegisters: [registerDocument('BUS-0001')([lathe])],
                farmForms: [],
            }))
            assertEq(f.line18bCents, 125261n)
        },
        /** **R2.** 15- and 20-year property straddles §1245 and §1250. */
        aStraddlingClassificationIsRefused: () => {
            for (const classification of straddlingClassifications) {
                const message = expectRefusal(overOneRegister([{
                    ...lathe, classification, method: '150DB',
                }]))
                assert(message.includes(classification),
                    ['the refusal must quote the class', message])
                assert(message.includes('coin flip'),
                    ['the refusal must say how far apart the two answers are', message])
                assert(message.includes('section1245OrSection1250'),
                    ['the refusal must name the field that would retire it', message])
            }
        },
        /**
         * THE CONTROL: the classes on either side of the straddle — 10-year
         * (§1245) and residential rental (§1250) — both compute. A check that
         * refused every disposal would pass the leaf above.
         *
         * The 10-year case lands in **Part I, not Part III**, and that is a
         * fact worth recording rather than working around: ten-year property
         * recovers more slowly than the lathe's seven-year schedule, so the
         * same $9,000.00 sale price against the same $20,001.00 basis is a
         * $1,618.52 LOSS instead of a $1,252.61 gain. The first version of this
         * leaf asserted a Part III property and reddened, which is the
         * hand-typed expectation doing its job on the fixture rather than on
         * the code.
         */
        theNeighbouringClassificationsAreAccepted: () => {
            const tenYear = expectOk(overOneRegister([{ ...lathe, classification: 'tenYear' }]))
            assertEq(tenYear.filed, true, 'ten-year property is characterized, not refused')
            assertEq(tenYear.line2Rows.length, 1, 'and it is a LOSS, so Part I')
            assertEq(tenYear.partIIIProperties.length, 0)
            assertEq(expectOk(overOneRegister([duplex])).partIIIProperties.length, 1)
        },
        /** **R3.** Business use below 100% needs an allocation nothing carries. */
        partialBusinessUseIsRefused: () => {
            const message = expectRefusal(overOneRegister([{
                ...lathe, businessUsePercentage: '60.00',
            }]))
            assert(message.includes('60.00%'),
                ['the refusal must quote the percentage', message])
            assert(message.includes('Schedule D that is'),
                ['the refusal must name the form that would be short', message])
        },
        /**
         * THE CONTROL, at the boundary: 100.00% computes and 99.99% does not.
         * Without the second half, an implementation comparing against zero
         * would pass.
         */
        theBusinessUseBoundary: () => {
            assertEq(expectOk(overOneRegister([lathe])).partIIIProperties.length, 1)
            expectRefusal(overOneRegister([{ ...lathe, businessUsePercentage: '99.99' }]))
        },
        /** **R1.** A register bound to a stored farm. */
        aFarmRegisterIsRefused: () => {
            const message = expectRefusal(formFortySevenNinetySeven({
                profile: fullyDeclaredProfile,
                assetRegisters: [registerDocument('FARM-0001')([lathe])],
                farmForms: [farmDocument('FARM-0001')],
            }))
            assert(message.includes('24 months or more'),
                ['the refusal must quote the livestock holding period', message])
            assert(message.includes('§1252'),
                ['the refusal must name the farmland section', message])
            assert(message.includes('FARM-0001'),
                ['the refusal must quote the account number that bound them', message])
        },
        /**
         * THE CONTROL, and it is a statement about the MATCH rather than about
         * farms: the same farm beside a register with a DIFFERENT account
         * number computes. A check that refused whenever any farm was stored
         * would pass the leaf above.
         */
        aFarmBesideAnUnrelatedRegisterComputes: () => {
            const f = expectOk(formFortySevenNinetySeven({
                profile: fullyDeclaredProfile,
                assetRegisters: [registerDocument('BUS-0001')([lathe])],
                farmForms: [farmDocument('FARM-0001')],
            }))
            assertEq(f.line18bCents, 125261n)
        },
    },
}
