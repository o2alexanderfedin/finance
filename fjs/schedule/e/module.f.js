/**
 * Schedule E (Form 1040) — *Supplemental Income and Loss*. Parts I, II and III
 * addressed in full, Part IV and Part V's line 40 refused by name, and Part V's
 * line 41 computed because it is the destination.
 *
 * TAX-35 shipped Parts II and III; Part I arrived afterwards, with
 * `vnd.fjs.rental_property` and `fjs/schedule/e/part_i` — see that submodule's
 * own docstring and
 * [./todo/schedule-e-part-i-rental-and-royalties.md](./todo/schedule-e-part-i-rental-and-royalties.md)
 * for why a rental PROFIT computes and a rental LOSS cannot.
 *
 * Source, transcribed from the printed 2025 `f1040se.pdf` face: Part I
 * (Income or Loss From Rental Real Estate and Royalties, lines 1-26), Part II
 * (Income or Loss From Partnerships and S Corporations, lines 27-32), Part III
 * (Income or Loss From Estates and Trusts, lines 33-37), Part IV (Income or
 * Loss From Real Estate Mortgage Investment Conduits, lines 38-39) and Part V
 * (Summary, lines 40-43).
 *
 * This is a STANDALONE, independently callable pure function over the declared
 * return profile and stored documents alone — the same relationship
 * `fjs/schedule/c`, `fjs/schedule/b`, `fjs/schedule/a` and `fjs/schedule/1`
 * have to their own inputs. It imports NOTHING at runtime from
 * `fjs/return/scope` or `fjs/form1040/`.
 *
 * ## "Parts I, IV and V are outside this requirement", and line 41
 *
 * TAX-35 asks for Parts II and III and puts Parts I, IV and V outside its
 * scope — and, in the same breath, says *"line 41's total feeds Schedule 1
 * line 5"*. Line 41 is Part V's. The two statements are consistent, and the
 * resolution is written here rather than left for a reader to reconcile:
 *
 * | Printed | This engine |
 * |---|---|
 * | Part I, lines 3-26 | **COMPUTES** — from `vnd.fjs.rental_property`, in `fjs/schedule/e/part_i`. A profitable property and a royalty compute; a LOSS refuses at printed line 21, because printed line 22 is Form 8582's |
 * | Part II, lines 27-32 | **COMPUTES** — this is the requirement |
 * | Part III, lines 33-37 | **COMPUTES** — columns (d) and (f) read `vnd.fjs.k1_1041` box 6 (TAX-35). This row said "REFUSES … every line is a documented zero" until the Part I wiring corrected it, which is the third row in this table to have gone stale between the code and the prose |
 * | Part IV, lines 38-39 | REFUSES by name, through `remicResidualInterest`; line 39 is a documented zero |
 * | Part V, line 40 | REFUSES by name, through `netFarmRentalIncomeForm4835` |
 * | Part V, **line 41** | **COMPUTES** — it is the sum of lines 26, 32, 37, 39 and 40, two of which (39 and 40) are documented zeros |
 * | Part V, lines 42-43 | documented zeros; neither is a summand of anything |
 *
 * Line 41 is not "Part V" in the sense the requirement excludes: it is the
 * arithmetic that carries Part II to Schedule 1, and excluding it would leave
 * the requirement with no destination. What is excluded is Part V's own
 * SUBSTANTIVE content — line 40's Form 4835, and the two reconciliations.
 *
 * **Lines 42 and 43 are reconciliations, not income.** Line 42 restates the
 * farming and fishing income already inside line 41, for §6654(i)'s
 * estimated-tax exception; line 43 restates a real estate professional's
 * participation for §469(c)(7). Neither is added to anything, which is why
 * both are documented zeros rather than refusals: a zero that no total reads
 * cannot move a figure.
 *
 * ## Part II is a TABLE, and this engine fills as many rows as it is given
 *
 * `fjs/schedule/c` refuses a SECOND business, because Schedule C is filed per
 * business and merging two would net one's loss against the other's without
 * either at-risk determination. **Schedule E is the opposite case and the
 * difference is the printed page's own**: line 28 is a four-row table with a
 * column (b) for *"P for partnership, S for S corporation"*, and the printed
 * instructions say to use additional Schedules E where there are more
 * entities while completing lines 27 through 32 on one of them. Combining is
 * what the form asks for.
 *
 * It is safe here for the reason Schedule C's is not: **every row that could
 * carry a loss refuses before any total is formed**, so no row's loss can be
 * netted against another's income. See "The net-loss decision" below.
 *
 * What DOES refuse is **two K-1s from the same entity**. Two documents sharing
 * a `payerTin` are either a duplicate transcription or an original and its
 * correction, and summing them reports the income twice —
 * {@link duplicateEntityRefusal}. `corrected` is stored on both dialects and
 * read by nothing, so this engine cannot tell the pair apart; it refuses
 * rather than choosing.
 *
 * ## Self-employment tax: three entity shapes, three answers
 *
 * This is the distinction that costs the most to get backwards — about 15.3%
 * of 92.35% of the share, roughly $11,300 on an $80,000 one — and it is the
 * reason DOC-24 asks for two dialects.
 *
 * | Entity and partner type | Self-employment tax | Authority |
 * |---|---|---|
 * | Partnership, **general** partner | **YES**, on 1065 box 14 code A | §1402(a); printed Schedule SE line 2 names the box |
 * | Partnership, **limited** partner | no (guaranteed payments for services aside) | §1402(a)(13) |
 * | **S corporation** shareholder | **NEVER**, whatever their involvement | Rev. Rul. 59-221 |
 *
 * {@link selfEmploymentEarningsForRow} is where those three answers live, and
 * `theOnlyDifferenceIsTheEntityTypeAndTheSelfEmploymentTaxDiffers` is the pair
 * of fixtures that prices the first and third against each other at
 * $11,303.64 and $0.00.
 *
 * **A general partner's box 14 code A is REQUIRED, not inferred from box 1.**
 * The printed Schedule SE line 2 asks for that box by name, and box 1 is not a
 * substitute: a partnership's box 1 can include items §1402 excludes, and its
 * code A can include guaranteed payments box 1 does not. So a general partner
 * with box 1 income and no code A row refuses
 * ({@link generalPartnerWithoutSelfEmploymentEarningsRefusal}), and a code A
 * that DISAGREES with box 1 refuses too
 * ({@link selfEmploymentEarningsDisagreeWithOrdinaryIncomeRefusal}) — because
 * on a K-1 this engine can otherwise compute, every box that could account for
 * the difference has already refused, so a difference means something is
 * present that nothing here can see.
 *
 * ## The passive/nonpassive columns, and the ONE thing they change
 *
 * Printed line 28 splits into *"Passive Income and Loss"* (columns f and g)
 * and *"Nonpassive Income and Loss"* (columns h, i and j), because the two are
 * limited differently. This engine keeps them distinct, and the determination
 * comes from three places in this order:
 *
 * 1. **§469(h)(2)**, for a limited partner: *"no interest as a limited partner
 *    … shall be treated as an interest with respect to which the taxpayer
 *    materially participates"*. Passive, by statute, with nothing to assert.
 * 2. The **stored `materialParticipation` assertion**, for a general partner
 *    or an S-corporation shareholder. §469(h)(1)'s "regular, continuous, and
 *    substantial" test is facts and circumstances (Temp. Reg. §1.469-5T's
 *    seven tests) and no information return reports it.
 * 3. **Absence refuses** ({@link materialParticipationUnstatedRefusal}).
 *    Reading an absent determination as either answer decides a question only
 *    the taxpayer can answer.
 *
 * **What the column actually changes, once losses refuse, is exactly one
 * thing**, and saying so is the honest alternative to a proof that pretends
 * otherwise. Both columns feed line 30 identically, so line 32, line 41,
 * Schedule 1 line 5 and 1040 line 8 are the same either way. The one figure
 * that moves is **Form 8960 line 4a**: §1411(c)(2)(A) makes income from a
 * PASSIVE trade or business net investment income, and §1411(c)(6) then takes
 * back out *"any item taken into account in determining self-employment
 * income"*.
 *
 * So this engine computes a passive row only when §1411(c)(6) covers the whole
 * of it, and {@link passiveIncomeOutsideSelfEmploymentRefusal} refuses
 * otherwise, naming Form 8960 line 4a. The two cases that produces:
 *
 * - A general partner who did NOT materially participate: passive, but the
 *   whole share is box 14 code A self-employment income, so §1411(c)(6)
 *   excludes it and Form 8960 line 4a stays honestly zero. **Computes** — and
 *   it is the CONTROL that keeps the refusal below from being a blanket ban on
 *   the passive column.
 * - A limited partner, or a shareholder who did not materially participate:
 *   passive with no self-employment income behind it, so the share IS net
 *   investment income and this engine has nowhere to put it. **Refuses.**
 *
 * ## The net-loss decision, which is `fjs/schedule/c`'s
 *
 * **A negative box 1 on any Schedule K-1 is REFUSED by name. A profit, and a
 * break-even zero, compute.** This is the same answer Phase 27 reached for
 * Schedule C line 31, reached the same way, and the reasons are stronger here
 * rather than merely analogous — there are THREE limitations rather than two,
 * and the first of them has no Schedule C counterpart at all:
 *
 * - **§704(d) / §1366(d), the basis limitation.** A partner's loss is
 *   deductible only to the extent of the adjusted basis of their interest; a
 *   shareholder's only to the extent of stock basis plus debt basis. Both are
 *   multi-year histories built from contributions, distributions, prior
 *   income and prior losses — the same SHAPE as Schedule C's §465 problem, one
 *   layer earlier in the ordering, and no document this engine holds carries
 *   any of it. The K-1's own printed box (item L, the capital account) is a
 *   §704(b) book figure, which is NOT tax basis.
 * - **§465, at risk.** Form 6198, exactly as on Schedule C line 32.
 * - **§469, passive activity.** Form 8582, exactly as on Schedule C line 32 —
 *   and it bites more often here, because a limited partner is passive by
 *   statute rather than by facts.
 *
 * So the arithmetic loss is an UPPER BOUND on the deductible loss, never the
 * deductible loss itself, and letting it reach Schedule 1 line 5 would deduct
 * more than the law allows and understate the tax — while moving adjusted
 * gross income and, with it, the 7.5% medical floor, Schedule 1-A's
 * senior-deduction phase-out, Form 8960's §1411 threshold, the Social Security
 * Benefits Worksheet and every credit Phases 24 and 25 wired.
 *
 * **It refuses PER ROW rather than on the line-32 total**, and that is the one
 * place this decision goes further than Schedule C's. Each entity's loss is
 * limited by its OWN basis and its OWN at-risk amount, so netting a
 * partnership's loss against an S corporation's profit before testing either
 * is the arithmetic §704(d) and §1366(d) exist to stop — the same argument
 * `fjs/schedule/c` makes for refusing to merge two businesses, applied to a
 * form that legitimately carries several.
 *
 * ## §199A: absent code Z means zero, and PRESENT code Z refuses
 *
 * 1065 box 20 code **Z** and 1120-S box 17 code **V** carry the §199A
 * information Form 8995 line 1 would need. Neither is usable here, and the two
 * cases have OPPOSITE answers:
 *
 * - **Present** — refuse ({@link section199AInformationRefusal}). The printed
 *   box routinely prints `STMT`, because the amounts live on an attached
 *   statement carrying up to four separate components (qualified business
 *   income, W-2 wages, unadjusted basis immediately after acquisition, and
 *   whether the trade or business is a specified service one). This engine
 *   holds no such statement, and the amount printed in the box alone is not
 *   the deduction's input.
 * - **Absent** — qualified business income from this entity is **zero**, and
 *   that is a rule rather than a default. Reg. §1.199A-6(b)(3)(iii): *"If an
 *   RPE fails to separately identify or report on the Schedule K-1 … the
 *   owner's share of QBI … the owner's share of positive QBI … will be
 *   presumed to be zero."* An entity that reported no §199A information has
 *   given its owner nothing to deduct, so Form 8995 is untouched and
 *   `fjs/form8995`'s line 1(i) stays the Schedule C figure it already was.
 *
 * ## The coded-box vocabulary is OWNED here, and it refuses by name
 *
 * `vnd.fjs.k1_1065` and `vnd.fjs.k1_1120s` keep their coded boxes as free
 * `(code, amount)` rows, exactly as `vnd.fjs.business_expenses` keeps
 * `category` a free string, and for the stated reason: deciding which line of
 * the return a coded item belongs on is deduction logic. This module is that
 * logic.
 *
 * It routes NONE of them and refuses every non-zero coded amount by name,
 * quoting the box, the code and the amount — with **two documented
 * exceptions**, 1065 box 14 codes B and C. Those are GROSS farming/fishing and
 * gross non-farm income, and they are inputs to Schedule SE Part II's optional
 * methods and to nothing else; `fjs/schedule/se`'s
 * `optionalMethodsPartII` refuses those methods outright and
 * `selfEmploymentOptionalMethods` is an `fjs/return/scope` kind, so no line
 * anywhere reads either figure. Refusing them would refuse an ordinary K-1
 * over two numbers that cannot change an answer.
 *
 * **This is a deliberate under-delivery against TAX-35's own words**, which
 * ask to *"route the ones the engine already models and refuse the rest by
 * name"*. Nothing is routed. Each routing — box 5 interest to 1040 line 2b,
 * box 6b qualified dividends to line 3a, box 8/9a to Schedule D — is a
 * separate wiring into a line that already computes from its own document
 * family, and a wrong one is a silent error in a figure that already looks
 * right. Refusing by name costs the filer a refusal and costs nobody a wrong
 * number, which is the trade this project makes everywhere else.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { materialParticipationNamed } from '../../document/k1_common/module.f.js'
import { scheduleEPartI } from './part_i/module.f.js'
// The ONE code this schedule's coded sweep lets through on the 1041 face, read
// from the module that computes it. See {@link estateTrustCodedBoxes}.
import { line2jCodes } from '../../form6251/estate_trust/module.f.js'

/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { RentalProperty } from '../../document/rental_property/module.f.js' */
/** @import { AssetRegister } from '../../document/asset_register/module.f.js' */
/** @import { ScheduleEPartI } from './part_i/module.f.js' */
/** @import { CodedEntry } from '../../document/k1_common/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it — mirrors `fjs/schedule/1`'s own
 * `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * A case this module will not compute — the same shape `fjs/schedule/c`,
 * `fjs/schedule/se`, `fjs/schedule/1` and `fjs/form8995` already return, so
 * `fjs/form1040/core` threads it through the error arm it already has. No
 * `unmodeled` field: every refusal here is document-data sufficiency
 * (12.1-CONTEXT.md Decision 2.6's category), never an `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleERefusal
 */

/** Printed line 28 column (b): *"P for partnership, S for S corporation"*.
 * @typedef {'P' | 'S'} EntityType
 */

/**
 * The pass-through entity whose separate-statement rule a refusal must cite.
 *
 * **Deliberately NOT a widening of {@link EntityType}.** That type is printed
 * line 28 column (b) and its vocabulary is the printed page's — there is no
 * `E` to enter in that column, because an estate or trust is reported in
 * printed Part III, whose own table has no such column at all. What the two
 * share is only that a refusal message must name the right statute, and `'E'`
 * names §652(b)/§662(b) where `'P'` names §702(a) and `'S'` §1366(a)(1).
 * Keeping them separate is what stops a beneficiary row ever reaching printed
 * line 28.
 * @typedef {EntityType | 'E'} PassThroughType
 */

/**
 * ONE Schedule K-1, of either dialect, reduced to the facts printed Schedule E
 * Part II needs — so the two dialects meet at exactly one place and every rule
 * below is written once.
 *
 * **The reduction is where the two box numberings are reconciled, and it is
 * the ONLY place they are.** `partnershipRow` and `sCorporationRow` each read
 * their own dialect's own field names; nothing downstream of them knows which
 * form the figures came from except through `entityType`, which is a printed
 * column rather than an inference.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly entityType: EntityType,
 *   readonly entityName: string,
 *   readonly employerIdentificationNumber: string,
 *   readonly recipientTin: string,
 *   readonly ordinaryBusinessIncomeCents: bigint,
 *   readonly ordinaryBusinessIncomePrinted: string | undefined,
 *   readonly boxPath: string,
 *   readonly selfEmploymentEarningsCents: bigint,
 *   readonly passive: boolean,
 * }} ScheduleERow
 */

/**
 * ONE `vnd.fjs.k1_1041` reduced to the facts printed Schedule E **Part III**
 * needs — the beneficiary counterpart of {@link ScheduleERow}, and a separate
 * type rather than a widening of it.
 *
 * The printed tables genuinely differ. Part II's line 28 has a column (b)
 * *"P or S"* and five income/loss columns split passive from nonpassive; Part
 * III's line 33 has an *"Employer identification number"* column and exactly
 * four — (c) passive deduction or loss allowed, (d) passive income, (e)
 * deduction or loss, (f) other income. A row that cannot be entered on line 28
 * should not have the type of one.
 *
 * **`selfEmploymentEarningsCents` is a STRUCTURAL zero and is carried out
 * anyway**, for `sCorporationRow`'s reason: a reader should see the term exists
 * and is zero because §1402(a) does not reach a beneficiary, rather than by
 * oversight. `theBeneficiaryAddsNoSelfEmploymentEarnings` is what holds it to
 * zero, and mutating the literal reddens it.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly entityName: string,
 *   readonly employerIdentificationNumber: string,
 *   readonly recipientTin: string,
 *   readonly ordinaryBusinessIncomeCents: bigint,
 *   readonly ordinaryBusinessIncomePrinted: string | undefined,
 *   readonly boxPath: string,
 *   readonly selfEmploymentEarningsCents: bigint,
 *   readonly passive: boolean,
 * }} ScheduleEBeneficiaryRow
 */

// ── Local helpers (reimplemented, not imported from `fjs/schedule/c`) ─────────

/**
 * A line that is zero because the taxpayer declared no such income, citing the
 * return profile's own `declaredKinds` box — `fjs/schedule/c`'s and
 * `fjs/schedule/1`'s identical helper, reimplemented locally per this tree's
 * "reimplement an idiom you cannot import" precedent.
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
 * {@link profileDeclaredZeroLine} when NO document supplied one — the hard
 * zero is REPLACED, not supplemented.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (value: bigint) => (sources: readonly Source[]) => ReportLine}
 */
const documentLine = profile => rule => value => sources => {
    const [first, ...rest] = sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value, sources: [first, ...rest], rule }
}

/** One money box's cents, with DOC-11's absent-is-absent rule.
 * @type {(printed: string | undefined) => bigint}
 */
const boxCents = printed => printed === undefined ? 0n : centsFromString(printed)

/**
 * The row of a coded box carrying one code, or `undefined`. The printed form
 * prints at most one row per code per box, so `find` is the whole rule.
 * @type {(rows: readonly CodedEntry[] | undefined) => (code: string) => CodedEntry | undefined}
 */
const codedRow = rows => code => (rows ?? []).find(row => row.code === code)

// ── The refusals, each a named function for a named rule ─────────────────────

/**
 * **Two Schedule K-1s from the SAME entity.** Either a duplicate
 * transcription or an original and its correction — and summing the pair
 * reports the income twice, while dropping one silently would report it once
 * from a document nobody chose.
 *
 * `corrected` is stored on both dialects and READ BY NOTHING, so this engine
 * genuinely cannot tell the two cases apart. It refuses rather than choosing,
 * naming the employer identification number both documents carry.
 * `printedLine` names the printed table the pair would have been entered on —
 * line 28 for Part II's partnerships and S corporations, line 33 for Part
 * III's estates and trusts. It is a parameter rather than a constant because
 * the rule is now shared by two printed parts, and a message naming the wrong
 * one sends a reader to the wrong table.
 * @type {(printedLine: string) => (entityIdentificationNumber: string) => (entityName: string) => ScheduleERefusal}
 */
export const duplicateEntityRefusal = printedLine => entityIdentificationNumber => entityName => ({
    kind: 'error',
    message: `${printedLine}: this return carries TWO Schedule K-1s from the same `
        + `entity, ${entityName}, employer identification number ${entityIdentificationNumber}. `
        + `They are either one document transcribed twice or an original and its correction, and `
        + `this engine cannot tell those apart — the printed "corrected" box is stored on both `
        + `Schedule K-1 dialects and read by nothing. Adding them would report the entity's `
        + `income twice; keeping one would be a choice nothing here is entitled to make. Store `
        + `exactly one Schedule K-1 per entity`,
})

/**
 * **The §469 determination, unstated.** Printed line 28 has two column pairs
 * and the taxpayer picks one; §469(h)(1)'s "regular, continuous, and
 * substantial" test is facts and circumstances (Temp. Reg. §1.469-5T's seven
 * tests) and no information return reports it.
 *
 * It is a refusal rather than a default for the reason
 * `fjs/form8995`'s `priorYearCarryforwardIsUnstated` gives about its own
 * assertion: reading an absent determination as either answer decides a
 * question only the taxpayer can answer, and the two answers move Form 8960
 * line 4a in opposite directions.
 * @type {(entityName: string) => (entityType: PassThroughType) => ScheduleERefusal}
 */
export const materialParticipationUnstatedRefusal = entityName => entityType => ({
    kind: 'error',
    message: `${entityType === 'E' ? 'Schedule E Part III line 33' : 'Schedule E Part II line 28'} `
        + `for ${entityName}: the Schedule K-1 does not state `
        + `whether you materially participated in this ${entityType === 'P' ? 'partnership'
            : entityType === 'S' ? 'S corporation'
                : 'estate or trust'}. `
        + `The printed line has ${entityType === 'E'
            ? 'a passive column (d) and a nonpassive column (f), which is what page 2 of the Schedule K-1 (Form 1041) means by "column (d) or (f)"'
            : 'two column pairs — passive (f and g) and nonpassive (h, i and j)'} `
        + `— and §469(h)(1)'s "regular, continuous, and substantial" test is a facts-and-`
        + `circumstances determination (Temp. Reg. §1.469-5T's seven tests) that no information `
        + `return reports. It decides, through §1411(c)(2)(A), whether this income is net `
        + `investment income on Form 8960 line 4a. Set materialParticipation on the Schedule K-1 `
        + `record to 'materiallyParticipated' or 'didNotMateriallyParticipate'; refusing rather `
        + `than making a §469 determination on a taxpayer's behalf`,
})

/**
 * **A LOSS.** The at-risk, basis and passive limitations, refused per row.
 * This module's own docstring, "The net-loss decision", carries the full
 * argument and the comparison with `fjs/schedule/c`'s
 * `atRiskDeterminationLine32`.
 * @type {(entityName: string) => (entityType: EntityType) => (lossCents: bigint) => ScheduleERefusal}
 */
export const lossLimitationsRefusal = entityName => entityType => lossCents => ({
    kind: 'error',
    message: `Schedule E Part II line 28 for ${entityName}: box 1 reports a LOSS of `
        + `${-lossCents} cents, and this engine cannot determine how much of it is deductible. `
        + `THREE limitations apply in order and none is computable here. `
        + `${entityType === 'P'
            ? '§704(d) allows the loss only to the extent of the adjusted basis of your partnership interest'
            : '§1366(d) allows the loss only to the extent of your stock basis plus your basis in debt the corporation owes you'}`
        + `, which is a multi-year history built from contributions, distributions, prior income `
        + `and prior losses — the printed capital-account box on the Schedule K-1 is a §704(b) `
        + `BOOK figure and is not tax basis. §465 then limits it to the amount at risk, on Form `
        + `6198. §469 then makes it deductible only against passive income, on Form 8582. So the `
        + `arithmetic loss is an UPPER BOUND on the deductible loss, never the deductible loss `
        + `itself, and letting it reach Schedule 1 line 5 would understate the tax while moving `
        + `adjusted gross income and every figure that depends on it. A PROFIT computes; a loss `
        + `refuses (the basis, at-risk and passive-loss limitations, no phase yet)`,
})

/**
 * **A LOSS in box 6 of a Schedule K-1 (Form 1041)** — and the authority is
 * NOT Part II's.
 *
 * `lossLimitationsRefusal` cites §704(d)/§1366(d), the basis limitations on a
 * partner's or shareholder's loss. Neither reaches a beneficiary, and citing
 * them here would be a plausible-looking wrong answer: a beneficiary is
 * generally allocated **no loss at all**. §643(a) computes distributable net
 * income without one, and §652(b)/§662(b) pass through only the character of
 * what distributable net income contains. §642(h) is the one provision that
 * passes a loss out, and it does so **only on termination** — in the estate's
 * or trust's final taxable year — where the printed form reports it in **box
 * 11** as a coded final-year deduction, not in box 6.
 *
 * So a negative box 6 is one of exactly two things, and both are refusals: a
 * transcription of the fiduciary's own figure rather than the beneficiary's
 * share, or a final-year item entered in the wrong box. Neither is a number to
 * net against anything.
 * @type {(entityName: string) => (lossCents: bigint) => ScheduleERefusal}
 */
export const beneficiaryLossRefusal = entityName => lossCents => ({
    kind: 'error',
    message: `Schedule E Part III line 33 for ${entityName}: box 6 of the Schedule K-1 (Form 1041) `
        + `reports a LOSS of ${-lossCents} cents, and a beneficiary is generally allocated no loss `
        + `at all. §643(a) computes distributable net income without one, and §652(b)/§662(b) pass `
        + `through only the character of what distributable net income contains. §642(h) is the `
        + `single provision that passes a loss out to a beneficiary, and it does so ONLY on `
        + `termination — the estate's or trust's FINAL taxable year — where the printed form reports `
        + `it in BOX 11 as a coded final-year deduction rather than in box 6. This is deliberately `
        + `not §704(d)'s or §1366(d)'s basis limitation, which is what Part II refuses under: `
        + `neither statute reaches a beneficiary, and citing one would name the wrong reason. So a `
        + `negative box 6 is either the fiduciary's own figure transcribed in place of the `
        + `beneficiary's share, or a final-year item entered in the wrong box, and both are `
        + `corrections to the record rather than an amount to carry to Schedule 1 line 5. Refusing `
        + `rather than netting a loss no provision allows this beneficiary`,
})

/**
 * **A general partner with ordinary business income and no box 14 code A.**
 *
 * Printed Schedule SE line 2 asks for *"Schedule K-1 (Form 1065), box 14, code
 * A"* by name, and box 1 is not a substitute in either direction — see this
 * module's own docstring. A general partner's share IS self-employment income
 * under §1402(a), so reading the missing box as zero would understate the tax
 * by about 15.3% of 92.35% of the share.
 * @type {(entityName: string) => (ordinaryIncomeCents: bigint) => ScheduleERefusal}
 */
export const generalPartnerWithoutSelfEmploymentEarningsRefusal = entityName => ordinaryIncomeCents => ({
    kind: 'error',
    message: `Schedule SE line 2 for ${entityName}: this Schedule K-1 (Form 1065) ticks box G `
        + `"General partner or LLC member-manager" and reports ${ordinaryIncomeCents} cents of `
        + `box 1 ordinary business income, but carries no box 14 code A (net earnings from `
        + `self-employment). §1402(a) makes a general partner's distributive share `
        + `self-employment income, and the printed Schedule SE line 2 asks for box 14 code A by `
        + `name — box 1 is not a substitute, because a partnership's box 1 can include items `
        + `§1402 excludes and its code A can include guaranteed payments box 1 does not. Reading `
        + `the absent box as zero would understate the self-employment tax by roughly 15.3% of `
        + `92.35% of the share. Ask the partnership for a Schedule K-1 with box 14 completed`,
})

/**
 * **Box 14 code A disagreeing with box 1**, on a K-1 this engine could
 * otherwise compute.
 *
 * Every box that could legitimately account for a difference — guaranteed
 * payments (4a/4b/4c), the §179 deduction (12), rental income (2 and 3), the
 * §1231 gain (10) and every coded deduction — has already refused when
 * non-zero by the time this runs. So a difference means the K-1 carries
 * something this engine cannot see, and picking either figure would be a guess
 * about which.
 * @type {(entityName: string) => (ordinaryIncomeCents: bigint) => (selfEmploymentCents: bigint) => ScheduleERefusal}
 */
export const selfEmploymentEarningsDisagreeWithOrdinaryIncomeRefusal = entityName => ordinaryIncomeCents => selfEmploymentCents => ({
    kind: 'error',
    message: `Schedule E / Schedule SE for ${entityName}: box 14 code A reports `
        + `${selfEmploymentCents} cents of net earnings from self-employment while box 1 reports `
        + `${ordinaryIncomeCents} cents of ordinary business income, and on a Schedule K-1 this `
        + `engine can otherwise compute the two must agree. Every box that could account for a `
        + `difference — guaranteed payments (4a, 4b, 4c), the section 179 deduction (12), rental `
        + `income (2 and 3), the section 1231 gain (10) and every coded deduction in box 13 — has `
        + `already refused when non-zero, so a difference means this Schedule K-1 carries `
        + `something nothing here can see. Refusing rather than choosing which of the two figures `
        + `to believe: taking box 1 would misstate the self-employment tax and taking code A `
        + `would misstate Schedule E`,
})

/**
 * **A limited partner with box 14 code A.** §1402(a)(13) excludes a limited
 * partner's distributive share from net earnings from self-employment *"other
 * than guaranteed payments described in section 707(c) … for services"*, and
 * those are printed in box 4a, which refuses when non-zero. So a limited
 * partner's code A cannot be reconciled with anything this engine can compute.
 * @type {(entityName: string) => (selfEmploymentCents: bigint) => ScheduleERefusal}
 */
export const limitedPartnerWithSelfEmploymentEarningsRefusal = entityName => selfEmploymentCents => ({
    kind: 'error',
    message: `Schedule SE line 2 for ${entityName}: this Schedule K-1 (Form 1065) ticks box G `
        + `"Limited partner or other LLC member" and yet reports ${selfEmploymentCents} cents in `
        + `box 14 code A. §1402(a)(13) excludes a limited partner's distributive share from net `
        + `earnings from self-employment other than §707(c) guaranteed payments for SERVICES, and `
        + `those are reported in box 4a, which this engine already refuses when non-zero. So the `
        + `two statements cannot both be honoured here. Refusing rather than charging a limited `
        + `partner self-employment tax the statute excludes, or discarding an amount the `
        + `partnership reported`,
})

/**
 * **Passive income that §1411(c)(6) does not take back out.** The one figure
 * the passive/nonpassive column actually changes — see this module's own
 * docstring, "The passive/nonpassive columns, and the ONE thing they change".
 * @type {(entityName: string) => (passiveIncomeCents: bigint) => (selfEmploymentCents: bigint) => ScheduleERefusal}
 */
export const passiveIncomeOutsideSelfEmploymentRefusal = entityName => passiveIncomeCents => selfEmploymentCents => ({
    kind: 'error',
    message: `Schedule E Part II line 28 column (g) for ${entityName}: ${passiveIncomeCents} `
        + `cents of PASSIVE income, of which only ${selfEmploymentCents} cents is subject to `
        + `self-employment tax. §1411(c)(2)(A) makes income from a trade or business that is a `
        + `passive activity NET INVESTMENT INCOME, and §1411(c)(6) then removes only the part `
        + `taken into account in determining self-employment income — so the remainder belongs on `
        + `Form 8960 line 4a, which this engine holds at a documented zero. Computing Schedule E `
        + `without it would understate the net investment income tax by 3.8% of the difference `
        + `for a filer above §1411(b)'s threshold. The column is not the problem: a general `
        + `partner whose whole share is box 14 code A is passive and computes, because `
        + `§1411(c)(6) covers all of it. Refusing rather than omitting a §1411 item (Form 8960 `
        + `line 4a, no phase yet)`,
})

/**
 * **§199A information present on the K-1.** Both the amount case and the
 * `STMT` case, because both mean the same thing: the components live on an
 * attached statement this engine does not hold.
 * @type {(entityName: string) => (box: string) => (code: string) => ScheduleERefusal}
 */
export const section199AInformationRefusal = entityName => box => code => ({
    kind: 'error',
    message: `Form 8995 line 1 for ${entityName}: this Schedule K-1 carries ${box} code ${code}, `
        + `which is §199A information — and this engine cannot use it. The printed box routinely `
        + `prints "STMT" rather than a figure, because the amounts live on an attached statement `
        + `carrying up to four separate components: the qualified business income, the W-2 wages, `
        + `the unadjusted basis immediately after acquisition of qualified property, and whether `
        + `the trade or business is a specified service one. The figure in the box alone is not `
        + `the deduction's input, and Form 8995-A — which the last two components exist for — is `
        + `not modeled (TAX-32 computes only the simplified case). An ABSENT ${code} would be a `
        + `different matter: Reg. §1.199A-6(b)(3)(iii) presumes an owner's share of positive `
        + `qualified business income to be ZERO where the entity failed to report it, so this `
        + `engine computes a return for an entity that reported nothing. Refusing rather than `
        + `reading one number as a deduction it is not`,
})

/**
 * **A coded box amount this engine does not route.** One message for every
 * coded box on both dialects, quoting the box, the code and the amount, and
 * naming §702(a)/§1366(a)(1)'s separate-statement rule as the reason it may
 * not simply be dropped.
 * @type {(entityName: string) => (entityType: PassThroughType) => (box: string) => (code: string) => (amount: string) => ScheduleERefusal}
 */
export const unroutedCodedItemRefusal = entityName => entityType => box => code => amount => ({
    kind: 'error',
    message: `Schedule K-1 for ${entityName}: ${box} code ${code} carries ${amount}, a separately `
        + `stated item this engine has no line for. `
        + `${entityType === 'P' ? '§702(a)'
            : entityType === 'S' ? '§1366(a)(1)'
                : '§652(b)/§662(b)'} requires each such item to be taken `
        + `into account SEPARATELY on its own line elsewhere on the return, so it belongs neither `
        + `on ${entityType === 'E' ? 'Schedule E Part III — which takes only box 6\'s ordinary business income —'
            : 'Schedule E Part II — which takes only box 1\'s ordinary business income —'} nor `
        + `nowhere. Dropping it would understate the tax where the item is income and overstate `
        + `it where the item is a deduction, and in both cases silently. Refusing rather than `
        + `computing a return that is short by a figure the entity did report (no phase yet)`,
})

// ── The parts this module addresses only in order to refuse ──────────────────

/**
 * **Part IV, Income or Loss From Real Estate Mortgage Investment Conduits
 * (lines 38-39).**
 * @type {() => ScheduleERefusal}
 */
export const partIVRealEstateMortgageInvestmentConduits = () => ({
    kind: 'error',
    message: 'Schedule E Part IV (lines 38-39), REMIC residual interests: this engine does not '
        + 'model it. The figures arrive on Schedule Q (Form 1066), which no dialect models, and '
        + '§860E(a) then does something no other line on this schedule does — it taxes the EXCESS '
        + 'INCLUSION whether or not anything was distributed, and forbids reducing it by any net '
        + 'operating loss. So a zero here is not merely an omission; it is a floor this engine '
        + 'cannot enforce, and the error runs in the understating direction (no phase yet)',
})

/**
 * **Part V line 40, net farm rental income or loss.** The one substantive line
 * in Part V; lines 41, 42 and 43 are a total and two reconciliations.
 * @type {() => ScheduleERefusal}
 */
export const partVNetFarmRentalIncomeLine40 = () => ({
    kind: 'error',
    message: 'Schedule E Part V line 40, net farm rental income or loss: this engine does not '
        + 'model it. The figure comes from Form 4835, which a landowner uses for crop-share rents '
        + 'received WITHOUT materially participating — and materially participating instead moves '
        + 'the whole activity to Schedule F, which `farmIncomeOrLoss` already refuses. Neither '
        + 'form is modeled, so both sides of that fork stop here (no phase yet)',
})

// ── Reducing one Schedule K-1 of either dialect to a Part II row ─────────────

/**
 * **1065 box 14 code A, and the three self-employment answers**, applied to
 * one already-reduced row's raw facts. See this module's own docstring for the
 * table and the authorities.
 *
 * Returns the earnings, or a refusal. It is a separate named function from
 * {@link partnershipRow} because it is the phase's single most consequential
 * rule and a reader should be able to find it by name.
 * @type {(entityName: string) => (input: { readonly generalPartner: boolean, readonly ordinaryIncomeCents: bigint, readonly codeA: CodedEntry | undefined }) => { readonly kind: 'ok', readonly cents: bigint } | ScheduleERefusal}
 */
export const selfEmploymentEarningsForRow = entityName => input => {
    const { generalPartner, ordinaryIncomeCents, codeA } = input
    if (codeA === undefined) {
        // A general partner MUST have one when there is income to report on
        // it. A break-even or absent box 1 has nothing to be short by, which
        // is what keeps this from refusing an ordinary zero-activity K-1.
        return generalPartner && ordinaryIncomeCents !== 0n
            ? generalPartnerWithoutSelfEmploymentEarningsRefusal(entityName)(ordinaryIncomeCents)
            : { kind: 'ok', cents: 0n }
    }
    const cents = boxCents(codeA.amount)
    if (!generalPartner) {
        return cents === 0n
            ? { kind: 'ok', cents: 0n }
            : limitedPartnerWithSelfEmploymentEarningsRefusal(entityName)(cents)
    }
    return cents === ordinaryIncomeCents
        ? { kind: 'ok', cents }
        : selfEmploymentEarningsDisagreeWithOrdinaryIncomeRefusal(entityName)(ordinaryIncomeCents)(cents)
}

/**
 * The 1065 coded boxes this module sweeps, and the codes it lets through.
 *
 * Box 14's codes B and C are the two documented exceptions — gross farming or
 * fishing income and gross non-farm income, which feed Schedule SE Part II's
 * optional methods and NOTHING else, and those methods are refused outright.
 * See this module's own docstring for the argument; without the exception an
 * ordinary K-1 would refuse over two numbers no line reads.
 *
 * Code A is let through because it is READ, by
 * {@link selfEmploymentEarningsForRow}. Code Z is let through HERE and refused
 * one check earlier by {@link section199AInformationRefusal}, which has more
 * to say about it than this sweep could.
 */
const partnershipCodedBoxes = /** @type {const} */ ([
    ['box11OtherIncome', 'box 11', /** @type {readonly string[]} */ ([])],
    ['box13OtherDeductions', 'box 13', /** @type {readonly string[]} */ ([])],
    ['box14SelfEmploymentEarnings', 'box 14', /** @type {readonly string[]} */ (['A', 'B', 'C'])],
    ['box15Credits', 'box 15', /** @type {readonly string[]} */ ([])],
    ['box17AlternativeMinimumTaxItems', 'box 17', /** @type {readonly string[]} */ ([])],
    ['box18TaxExemptIncomeAndNondeductibleExpenses', 'box 18', /** @type {readonly string[]} */ ([])],
    ['box19Distributions', 'box 19', /** @type {readonly string[]} */ ([])],
    ['box20OtherInformation', 'box 20', /** @type {readonly string[]} */ (['Z'])],
])

/**
 * The 1120-S coded boxes, and the one code let through: box 17 code V, which
 * {@link section199AInformationRefusal} handles one check earlier.
 */
const sCorporationCodedBoxes = /** @type {const} */ ([
    ['box10OtherIncome', 'box 10', /** @type {readonly string[]} */ ([])],
    ['box12OtherDeductions', 'box 12', /** @type {readonly string[]} */ ([])],
    ['box13Credits', 'box 13', /** @type {readonly string[]} */ ([])],
    ['box15AlternativeMinimumTaxItems', 'box 15', /** @type {readonly string[]} */ ([])],
    ['box16ItemsAffectingShareholderBasis', 'box 16', /** @type {readonly string[]} */ ([])],
    ['box17OtherInformation', 'box 17', /** @type {readonly string[]} */ (['V'])],
])

/**
 * Sweeps one document's coded boxes for a non-zero amount this engine does not
 * route. Written once over a `(field, printedBox, passThroughCodes)` table so
 * the two dialects share the rule and differ only in the table.
 * @type {(entityName: string) => (entityType: PassThroughType) => (boxes: readonly (readonly [string, string, readonly string[]])[]) => (rowsOf: (field: string) => readonly CodedEntry[] | undefined) => ScheduleERefusal | { readonly kind: 'ok' }}
 */
const codedBoxSweep = entityName => entityType => boxes => rowsOf => {
    for (const [field, printedBox, passThroughCodes] of boxes) {
        for (const row of rowsOf(field) ?? []) {
            if (passThroughCodes.includes(row.code)) {
                continue
            }
            const printed = row.amount
            if (printed === undefined || centsFromString(printed) === 0n) {
                continue
            }
            return unroutedCodedItemRefusal(entityName)(entityType)(printedBox)(row.code)(printed)
        }
    }
    return { kind: 'ok' }
}

/**
 * One `vnd.fjs.k1_1065` reduced to a {@link ScheduleERow}, or the refusal that
 * stops the return.
 *
 * The order of the checks is the order they must run in:
 * 1. **§199A information**, before the general coded sweep, because box 20
 *    code Z has its own message and the sweep would give it the generic one.
 * 2. **The coded sweep**, before anything is read, so no total is formed from
 *    a document carrying an item this engine drops.
 * 3. **The loss**, before the column, because a loss refuses whichever column
 *    it would have gone in.
 * 4. **Self-employment earnings**, before the §1411(c)(6) gate, which reads
 *    them.
 * 5. **The column**, then the gate.
 * @type {(document: Stored<K1Partnership>) => { readonly kind: 'ok', readonly row: ScheduleERow } | ScheduleERefusal}
 */
export const partnershipRow = document => {
    const k1 = document.value
    const entityName = k1.payerName ?? `partnership ${k1.payerTin}`
    const zRow = codedRow(k1.box20OtherInformation)('Z')
    if (zRow !== undefined) {
        return section199AInformationRefusal(entityName)('box 20')('Z')
    }
    const swept = codedBoxSweep(entityName)('P')(partnershipCodedBoxes)(
        field => field === 'box11OtherIncome' ? k1.box11OtherIncome
            : field === 'box13OtherDeductions' ? k1.box13OtherDeductions
            : field === 'box14SelfEmploymentEarnings' ? k1.box14SelfEmploymentEarnings
            : field === 'box15Credits' ? k1.box15Credits
            : field === 'box17AlternativeMinimumTaxItems' ? k1.box17AlternativeMinimumTaxItems
            : field === 'box18TaxExemptIncomeAndNondeductibleExpenses' ? k1.box18TaxExemptIncomeAndNondeductibleExpenses
            : field === 'box19Distributions' ? k1.box19Distributions
            : k1.box20OtherInformation)
    if (swept.kind === 'error') {
        return swept
    }
    const ordinaryBusinessIncomeCents = boxCents(k1.box1OrdinaryBusinessIncome)
    if (ordinaryBusinessIncomeCents < 0n) {
        return lossLimitationsRefusal(entityName)('P')(ordinaryBusinessIncomeCents)
    }
    // Box G ticks exactly one side — `vnd.fjs.k1_1065`'s own
    // `checkReferences` refuses a document that does not, so this is a read
    // rather than a decision.
    const generalPartner = k1.boxGGeneralPartnerOrLlcMemberManager === true
    const earnings = selfEmploymentEarningsForRow(entityName)({
        generalPartner,
        ordinaryIncomeCents: ordinaryBusinessIncomeCents,
        codeA: codedRow(k1.box14SelfEmploymentEarnings)('A'),
    })
    if (earnings.kind === 'error') {
        return earnings
    }
    // §469(h)(2) settles the column for a limited partner and the stored
    // determination settles it for a general one. `materialParticipationNamed`
    // returns `undefined` for an absent assertion, which is the third state
    // DOC-11 keeps distinct from either answer.
    const stated = materialParticipationNamed(k1.materialParticipation)
    if (generalPartner && stated === undefined) {
        return materialParticipationUnstatedRefusal(entityName)('P')
    }
    const passive = !generalPartner || stated === 'didNotMateriallyParticipate'
    if (passive && ordinaryBusinessIncomeCents > earnings.cents) {
        return passiveIncomeOutsideSelfEmploymentRefusal(entityName)(ordinaryBusinessIncomeCents)(earnings.cents)
    }
    return {
        kind: 'ok',
        row: {
            documentHash: document.documentHash,
            entityType: 'P',
            entityName,
            employerIdentificationNumber: k1.payerTin,
            recipientTin: k1.recipientTin,
            ordinaryBusinessIncomeCents,
            ordinaryBusinessIncomePrinted: k1.box1OrdinaryBusinessIncome,
            boxPath: 'box1OrdinaryBusinessIncome',
            selfEmploymentEarningsCents: earnings.cents,
            passive,
        },
    }
}

/**
 * One `vnd.fjs.k1_1120s` reduced to a {@link ScheduleERow}, or the refusal
 * that stops the return. The same check order as {@link partnershipRow},
 * minus the two that have no counterpart here: there is no partner type and
 * there is no self-employment box, because an S-corporation shareholder's
 * share is never self-employment income (Rev. Rul. 59-221).
 *
 * **`selfEmploymentEarningsCents` is therefore a STRUCTURAL zero**, written
 * out as a named `const` rather than omitted, so a reader can see the term
 * exists and is zero for a reason rather than by oversight — the discipline
 * `fjs/form8995`'s `qualifiedBusinessIncome` follows for its own two permanent
 * zeros.
 * @type {(document: Stored<K1SCorporation>) => { readonly kind: 'ok', readonly row: ScheduleERow } | ScheduleERefusal}
 */
export const sCorporationRow = document => {
    const k1 = document.value
    const entityName = k1.payerName ?? `S corporation ${k1.payerTin}`
    const vRow = codedRow(k1.box17OtherInformation)('V')
    if (vRow !== undefined) {
        return section199AInformationRefusal(entityName)('box 17')('V')
    }
    const swept = codedBoxSweep(entityName)('S')(sCorporationCodedBoxes)(
        field => field === 'box10OtherIncome' ? k1.box10OtherIncome
            : field === 'box12OtherDeductions' ? k1.box12OtherDeductions
            : field === 'box13Credits' ? k1.box13Credits
            : field === 'box15AlternativeMinimumTaxItems' ? k1.box15AlternativeMinimumTaxItems
            : field === 'box16ItemsAffectingShareholderBasis' ? k1.box16ItemsAffectingShareholderBasis
            : k1.box17OtherInformation)
    if (swept.kind === 'error') {
        return swept
    }
    const ordinaryBusinessIncomeCents = boxCents(k1.box1OrdinaryBusinessIncome)
    if (ordinaryBusinessIncomeCents < 0n) {
        return lossLimitationsRefusal(entityName)('S')(ordinaryBusinessIncomeCents)
    }
    // Rev. Rul. 59-221: an S-corporation shareholder's pro rata share is NOT
    // net earnings from self-employment, whatever their involvement. There is
    // no box to read and no partner type to ask about, and the counterpart
    // rule -- that a shareholder-employee must be paid reasonable compensation
    // on a Form W-2 -- is a §3121 question about wages 1040 line 1a already
    // reads.
    const selfEmploymentEarningsCents = 0n
    const stated = materialParticipationNamed(k1.materialParticipation)
    if (stated === undefined) {
        return materialParticipationUnstatedRefusal(entityName)('S')
    }
    const passive = stated === 'didNotMateriallyParticipate'
    if (passive && ordinaryBusinessIncomeCents > selfEmploymentEarningsCents) {
        return passiveIncomeOutsideSelfEmploymentRefusal(entityName)(ordinaryBusinessIncomeCents)(selfEmploymentEarningsCents)
    }
    return {
        kind: 'ok',
        row: {
            documentHash: document.documentHash,
            entityType: 'S',
            entityName,
            employerIdentificationNumber: k1.payerTin,
            recipientTin: k1.recipientTin,
            ordinaryBusinessIncomeCents,
            ordinaryBusinessIncomePrinted: k1.box1OrdinaryBusinessIncome,
            boxPath: 'box1OrdinaryBusinessIncome',
            selfEmploymentEarningsCents,
            passive,
        },
    }
}

/**
 * The `vnd.fjs.k1_1041` coded boxes, and the codes let through: **box 12's code
 * A, and nothing else.**
 *
 * Box 9's codes A, B and C are directly apportioned deductions — depreciation,
 * depletion and amortization — which page 2 routes to line 33 column (c) or
 * (e), the *deduction* columns this engine holds at documented zeros. They are
 * therefore swept like every other coded amount rather than passed through:
 * letting one ride into column (d) or (f) would enter a deduction as income.
 *
 * **Box 12 code A is the one code this table lets through, and it is not read
 * on this schedule at all** — it is Form 6251 line 2j, whose printed caption
 * names the box and the code outright: *"Estates and trusts (amount from
 * Schedule K-1 (Form 1041), box 12, code A)"*. The pass-through list is
 * {@link line2jCodes}, **imported rather than restated**, so the gate cannot
 * open wider than the computation that reads it — the sweep's job here is to
 * refuse an item nothing routes, and one list is what makes "nothing routes it"
 * a checkable claim rather than two opinions (AGENTS.md, "one rule, one
 * place").
 *
 * Box 12's other NINE codes still refuse, and for two different reasons worth
 * keeping apart: codes B-F are *"the portion, if any, of the amount included in
 * code A"* (`i1041sk1.pdf`) bound for Part III's AMT capital-gain worksheets,
 * which `fjs/form6251/part3` does not refigure per K-1; codes G, H and I are
 * accelerated depreciation, depletion and amortization, which belong on Form
 * 6251 lines 2l, 2d and their neighbours — every one a documented zero with its
 * own live `fjs/return/scope` kind. Code J is not a Form 6251 item at all: it
 * feeds the following year's Form 8801.
 *
 * Boxes 11, 13 and 14 are the final-year deductions, the credits and *other
 * information*; none has a destination this engine computes.
 */
const estateTrustCodedBoxes = /** @type {const} */ ([
    ['box9DirectlyApportionedDeductions', 'box 9', /** @type {readonly string[]} */ ([])],
    ['box11FinalYearDeductions', 'box 11', /** @type {readonly string[]} */ ([])],
    ['box12AlternativeMinimumTaxItems', 'box 12', line2jCodes],
    ['box13CreditsAndCreditRecapture', 'box 13', /** @type {readonly string[]} */ ([])],
    ['box14OtherInformation', 'box 14', /** @type {readonly string[]} */ ([])],
])

/**
 * One `vnd.fjs.k1_1041` reduced to a {@link ScheduleEBeneficiaryRow}, or the
 * refusal that stops the return. **This is the reader `vnd.fjs.k1_1041` did not
 * have.**
 *
 * A registered dialect nothing reads is the `box13StatutoryEmployee` defect
 * Phase 27 found in `vnd.fjs.w2`: a field, or here a whole face, transcribed
 * and stored and consumed by no computation, so nothing can ever notice it
 * being wrong. That is what this function closes.
 *
 * The check order is {@link sCorporationRow}'s, and the two differences are
 * both structural rather than omissions:
 * 1. **The coded sweep lets no code through.** There is no box 20 code Z and no
 *    box 17 code V here — this face carries no §199A information at all,
 *    because §199A(c)(3)(A) qualified business income is the *entity's* and an
 *    estate or trust apportions it under §199A(f)(1)(B) through box 14, which
 *    the sweep refuses by name.
 * 2. **The loss refuses under §642(h)/§643, not §704(d)** — see
 *    {@link beneficiaryLossRefusal}.
 *
 * `selfEmploymentEarningsCents` is a structural zero: §1402(a) reaches the
 * trade or business *carried on* by the taxpayer, and a beneficiary of an
 * estate or trust does not carry on the fiduciary's business. It is the same
 * position an S-corporation shareholder is in under Rev. Rul. 59-221, reached
 * by a different route.
 *
 * The existing §1411(c)(6) gate then handles the passive case unchanged, and
 * for a beneficiary it always bites when the column is passive, because the
 * self-employment term is zero by construction.
 * @type {(document: Stored<K1EstateTrust>) => { readonly kind: 'ok', readonly row: ScheduleEBeneficiaryRow } | ScheduleERefusal}
 */
export const beneficiaryRow = document => {
    const k1 = document.value
    const entityName = k1.payerName ?? `estate or trust ${k1.payerTin}`
    const swept = codedBoxSweep(entityName)('E')(estateTrustCodedBoxes)(
        field => field === 'box9DirectlyApportionedDeductions' ? k1.box9DirectlyApportionedDeductions
            : field === 'box11FinalYearDeductions' ? k1.box11FinalYearDeductions
                : field === 'box12AlternativeMinimumTaxItems' ? k1.box12AlternativeMinimumTaxItems
                    : field === 'box13CreditsAndCreditRecapture' ? k1.box13CreditsAndCreditRecapture
                        : k1.box14OtherInformation)
    if (swept.kind === 'error') {
        return swept
    }
    const ordinaryBusinessIncomeCents = boxCents(k1.box6OrdinaryBusinessIncome)
    if (ordinaryBusinessIncomeCents < 0n) {
        return beneficiaryLossRefusal(entityName)(ordinaryBusinessIncomeCents)
    }
    // §1402(a) reaches a trade or business carried on BY the taxpayer. A
    // beneficiary does not carry on the fiduciary's, so there is no box to read
    // and no entity type to ask about -- the same structural zero
    // `sCorporationRow` writes out under Rev. Rul. 59-221, reached by a
    // different route.
    const selfEmploymentEarningsCents = 0n
    const stated = materialParticipationNamed(k1.materialParticipation)
    if (stated === undefined) {
        return materialParticipationUnstatedRefusal(entityName)('E')
    }
    const passive = stated === 'didNotMateriallyParticipate'
    if (passive && ordinaryBusinessIncomeCents > selfEmploymentEarningsCents) {
        return passiveIncomeOutsideSelfEmploymentRefusal(entityName)(ordinaryBusinessIncomeCents)(selfEmploymentEarningsCents)
    }
    return {
        kind: 'ok',
        row: {
            documentHash: document.documentHash,
            entityName,
            employerIdentificationNumber: k1.payerTin,
            recipientTin: k1.recipientTin,
            ordinaryBusinessIncomeCents,
            ordinaryBusinessIncomePrinted: k1.box6OrdinaryBusinessIncome,
            boxPath: 'box6OrdinaryBusinessIncome',
            selfEmploymentEarningsCents,
            passive,
        },
    }
}

// ── Part II: lines 27 through 32 ─────────────────────────────────────────────

/**
 * Part II's printed fields.
 *
 * `line27` is the printed Yes/No question, not an amount. `line28f`, `line28h`
 * and `line28i` are the loss and §179 columns, which are STRUCTURAL zeros —
 * every input that could give one a value refuses above — and they are here
 * because printed line 29b adds them.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line27: boolean,
 *   readonly rows: readonly ScheduleERow[],
 *   readonly line28f: ReportLine, readonly line28g: ReportLine,
 *   readonly line28h: ReportLine, readonly line28i: ReportLine,
 *   readonly line28j: ReportLine,
 *   readonly line29aG: ReportLine, readonly line29aJ: ReportLine,
 *   readonly line29bF: ReportLine, readonly line29bH: ReportLine, readonly line29bI: ReportLine,
 *   readonly line30: ReportLine, readonly line31: ReportLine, readonly line32: ReportLine,
 * }} ScheduleEPartII
 */

/**
 * Schedule E Part II — lines 27 through 32.
 *
 * Every `const` below is one printed line or column, in printed order, with
 * the printed instruction quoted above it.
 * @type {(profile: Stored<ReturnProfile>) => (rows: readonly ScheduleERow[]) => ScheduleEPartII}
 */
export const scheduleEPartII = profile => rows => {
    const zero = profileDeclaredZeroLine(profile)
    // 27. "Are you reporting any loss not allowed in a prior year due to the
    //     at-risk, excess farm loss, or basis limitations, a prior year
    //     unallowed loss from a passive activity (if that loss was not
    //     reported on Form 8582), or unreimbursed partnership expenses?"
    //
    //     A documented NO, and the direction of the error is worth stating:
    //     this engine holds ONE tax year, so it has no prior-year unallowed
    //     loss and no basis history to carry one in; and unreimbursed
    //     partnership expenses are a taxpayer assertion no document here
    //     carries. Answering No where a taxpayer has UPE omits a DEDUCTION,
    //     which overstates the tax rather than understating it -- the safer of
    //     the two directions, and the one this project accepts as a documented
    //     zero rather than a refusal (`fjs/schedule/c` line 2's own reasoning).
    const line27 = false
    /** @type {(predicate: (row: ScheduleERow) => boolean) => readonly Source[]} */
    const sourcesWhere = predicate => rows.filter(predicate).flatMap(row =>
        row.ordinaryBusinessIncomePrinted === undefined
            ? []
            : [{
                documentHash: row.documentHash,
                boxPath: row.boxPath,
                value: row.ordinaryBusinessIncomePrinted,
            }])
    /** @type {(predicate: (row: ScheduleERow) => boolean) => bigint} */
    const totalWhere = predicate => rows
        .filter(predicate)
        .reduce((total, row) => total + row.ordinaryBusinessIncomeCents, 0n)
    // 28(f). "Passive loss allowed (attach Form 8582 if required)." A
    //        structural zero: every loss refuses at
    //        {@link lossLimitationsRefusal} before this line is built.
    const line28f = zero('Schedule E line 28 column (f) (passive loss allowed)')
    // 28(g). "Passive income from Schedule K-1."
    const line28g = documentLine(profile)('Schedule E line 28 column (g) (passive income from Schedule K-1)')(
        totalWhere(row => row.passive))(sourcesWhere(row => row.passive))
    // 28(h). "Nonpassive loss allowed (see instructions)." Structural zero.
    const line28h = zero('Schedule E line 28 column (h) (nonpassive loss allowed)')
    // 28(i). "Section 179 expense deduction from Form 4562." Structural zero:
    //        1065 box 12 and 1120-S box 11 both refuse at storage when
    //        non-zero, naming this very column. `fjs/form4562` exists as of the
    //        asset-register commit and does NOT change that: it refuses Part I
    //        by name, because a partner's §179 deduction is limited on line 11
    //        by their own business income and line 13 carries the disallowed
    //        part into a year this engine cannot store.
    const line28i = zero('Schedule E line 28 column (i) (section 179 expense deduction)')
    // 28(j). "Nonpassive income from Schedule K-1."
    const line28j = documentLine(profile)('Schedule E line 28 column (j) (nonpassive income from Schedule K-1)')(
        totalWhere(row => !row.passive))(sourcesWhere(row => !row.passive))
    // 29a. "Totals" -- columns (g) and (j).
    const line29aG = { ...line28g, rule: 'Schedule E line 29a column (g) (totals)' }
    const line29aJ = { ...line28j, rule: 'Schedule E line 29a column (j) (totals)' }
    // 29b. "Totals" -- columns (f), (h) and (i).
    const line29bF = { ...line28f, rule: 'Schedule E line 29b column (f) (totals)' }
    const line29bH = { ...line28h, rule: 'Schedule E line 29b column (h) (totals)' }
    const line29bI = { ...line28i, rule: 'Schedule E line 29b column (i) (totals)' }
    // 30. "Add columns (g) and (j) of line 29a."
    const line30 = totalLine('Schedule E line 30 (add columns (g) and (j) of line 29a)')([line29aG, line29aJ])
    // 31. "Add columns (f), (h), and (i) of line 29b." The printed box is
    //     PARENTHESISED -- the three columns hold positive magnitudes and the
    //     sign is applied here, exactly as `fjs/form8995` line 3 applies its
    //     own. All three are structural zeros, so the negation is unobservable
    //     today and is written the way the page prints it rather than
    //     minimised away.
    const line31 = {
        value: -(line29bF.value + line29bH.value + line29bI.value),
        sources: unionSources([line29bF, line29bH, line29bI]),
        rule: 'Schedule E line 31 (add columns (f), (h) and (i) of line 29b)',
    }
    // 32. "Total partnership and S corporation income or (loss). Combine
    //     lines 30 and 31. Enter the result here and include in the total on
    //     line 41 below."
    const line32 = totalLine('Schedule E line 32 (total partnership and S corporation income or loss)')([line30, line31])
    return {
        kind: 'ok', line27, rows,
        line28f, line28g, line28h, line28i, line28j,
        line29aG, line29aJ, line29bF, line29bH, line29bI,
        line30, line31, line32,
    }
}

// ── Part III's computed lines, and Parts IV and V's documented zeros ─────────

/**
 * Part III's printed fields (lines 33-37), Part IV's (38-39) and Part V's
 * (40-43), plus Part I's own line 26 threaded through from
 * `fjs/schedule/e/part_i`. Part III's columns (d) and (f) carry real readings
 * and line 26 now does too; every other line but 41 is a documented zero. See
 * this module's own docstring for which part each refuses through.
 * @typedef {{
 *   readonly beneficiaryRows: readonly ScheduleEBeneficiaryRow[],
 *   readonly line33c: ReportLine, readonly line33d: ReportLine,
 *   readonly line33e: ReportLine, readonly line33f: ReportLine,
 *   readonly line34aD: ReportLine, readonly line34aF: ReportLine,
 *   readonly line34bC: ReportLine, readonly line34bE: ReportLine,
 *   readonly line35: ReportLine, readonly line36: ReportLine, readonly line37: ReportLine,
 *   readonly line38: ReportLine, readonly line39: ReportLine,
 *   readonly line40: ReportLine, readonly line41: ReportLine,
 *   readonly line42: ReportLine, readonly line43: ReportLine,
 *   readonly line26: ReportLine,
 * }} ScheduleERemainingParts
 */

/**
 * Parts III, IV and V, plus Part I's own line 26 — every printed line that
 * feeds line 41, and line 41 itself.
 *
 * **`beneficiaryRows` is the second parameter and it is not optional.** Part
 * III used to be four documented zeros, so this function needed nothing but
 * line 32; now that columns (d) and (f) read real documents, a caller that
 * cannot supply the rows is a caller that would silently produce a Schedule E
 * missing a beneficiary's income. An empty array is the honest way to say
 * "no Schedule K-1 (Form 1041)", and it reproduces the old behaviour exactly —
 * `documentLine` falls back to the profile-cited zero when no row supplied a
 * source.
 *
 * **`line26` is now PASSED IN, and that is the Schedule E Part I wiring.** It
 * was a documented zero built here, on the stated grounds that Part I refused
 * whole; `fjs/schedule/e/part_i` computes it now, and building a second zero
 * here would be a line 41 that silently drops a landlord's rent. The parameter
 * sits FIRST among the three, in printed order.
 * @type {(profile: Stored<ReturnProfile>) => (line26: ReportLine) => (line32: ReportLine) => (beneficiaryRows: readonly ScheduleEBeneficiaryRow[]) => ScheduleERemainingParts}
 */
export const scheduleERemainingParts = profile => line26 => line32 => beneficiaryRows => {
    const zero = profileDeclaredZeroLine(profile)
    // 33(c)-(f). The four Part III columns: passive deduction or loss allowed,
    //            passive income, nonpassive deduction or loss, other income.
    //
    //            Columns (d) and (f) are the two page 2 of the Schedule K-1
    //            (Form 1041) names for box 6 -- "Schedule E, line 33, column
    //            (d) or (f)" -- and which of the two is the §469
    //            material-participation determination `beneficiaryRow` refuses
    //            to make on the taxpayer's behalf.
    /** @type {(predicate: (row: ScheduleEBeneficiaryRow) => boolean) => readonly Source[]} */
    const beneficiarySourcesWhere = predicate => beneficiaryRows.filter(predicate).flatMap(row =>
        row.ordinaryBusinessIncomePrinted === undefined
            ? []
            : [{
                documentHash: row.documentHash,
                boxPath: row.boxPath,
                value: row.ordinaryBusinessIncomePrinted,
            }])
    /** @type {(predicate: (row: ScheduleEBeneficiaryRow) => boolean) => bigint} */
    const beneficiaryTotalWhere = predicate => beneficiaryRows
        .filter(predicate)
        .reduce((total, row) => total + row.ordinaryBusinessIncomeCents, 0n)
    // 33(c). "Passive deduction or loss allowed (attach Form 8582 if
    //        required)." A structural zero: box 9's directly apportioned
    //        deductions -- the only amounts that could reach this column -- are
    //        swept by `estateTrustCodedBoxes`, and a negative box 6 refuses at
    //        {@link beneficiaryLossRefusal} before this line is built.
    const line33c = zero('Schedule E line 33 column (c) (passive deduction or loss allowed)')
    const line33d = documentLine(profile)('Schedule E line 33 column (d) (passive income from Schedule K-1)')(
        beneficiaryTotalWhere(row => row.passive))(beneficiarySourcesWhere(row => row.passive))
    // 33(e). "Deduction or loss from Schedule K-1." Structural zero, for
    //        column (c)'s two reasons.
    const line33e = zero('Schedule E line 33 column (e) (deduction or loss from Schedule K-1)')
    const line33f = documentLine(profile)('Schedule E line 33 column (f) (other income from Schedule K-1)')(
        beneficiaryTotalWhere(row => !row.passive))(beneficiarySourcesWhere(row => !row.passive))
    // 34a. "Totals" -- columns (d) and (f). 34b. "Totals" -- (c) and (e).
    const line34aD = { ...line33d, rule: 'Schedule E line 34a column (d) (totals)' }
    const line34aF = { ...line33f, rule: 'Schedule E line 34a column (f) (totals)' }
    const line34bC = { ...line33c, rule: 'Schedule E line 34b column (c) (totals)' }
    const line34bE = { ...line33e, rule: 'Schedule E line 34b column (e) (totals)' }
    // 35. "Add columns (d) and (f) of line 34a."
    const line35 = totalLine('Schedule E line 35 (add columns (d) and (f) of line 34a)')([line34aD, line34aF])
    // 36. "Add columns (c) and (e) of line 34b." Parenthesised on the page,
    //     like line 31.
    const line36 = {
        value: -(line34bC.value + line34bE.value),
        sources: unionSources([line34bC, line34bE]),
        rule: 'Schedule E line 36 (add columns (c) and (e) of line 34b)',
    }
    // 37. "Total estate and trust income or (loss). Combine lines 35 and 36."
    const line37 = totalLine('Schedule E line 37 (total estate and trust income or loss)')([line35, line36])
    // 38. Part IV's REMIC table -- the taxable income (net loss) and the
    //     income from Schedules Q. 39. "Combine columns (d) and (e) only."
    const line38 = zero('Schedule E line 38 (REMIC residual interests, Schedules Q)')
    const line39 = { ...line38, rule: 'Schedule E line 39 (total REMIC income or loss)' }
    // 40. "Net farm rental income or (loss) from Form 4835."
    const line40 = zero('Schedule E line 40 (net farm rental income or loss, Form 4835)')
    // 41. "Total income or (loss). Combine lines 26, 32, 37, 39, and 40. Enter
    //     the result here and on Schedule 1 (Form 1040), line 5."
    //
    //     THE DESTINATION. Four of the five summands are documented zeros, and
    //     they are summed rather than dropped because the printed form sums
    //     them -- the day any of the four starts computing, this line already
    //     carries it.
    const line41 = totalLine('Schedule E line 41 (total income or loss -> Schedule 1 line 5)')([
        line26, line32, line37, line39, line40,
    ])
    // 42. "Reconciliation of farming and fishing income." 43. "Reconciliation
    //     for real estate professionals." Neither is a summand of anything:
    //     each RESTATES a figure already inside line 41, line 42 for
    //     §6654(i)'s estimated-tax exception and line 43 for §469(c)(7). Both
    //     are documented zeros because both restate zeros.
    const line42 = zero('Schedule E line 42 (reconciliation of farming and fishing income)')
    const line43 = zero('Schedule E line 43 (reconciliation for real estate professionals)')
    return {
        beneficiaryRows,
        line26, line33c, line33d, line33e, line33f,
        line34aD, line34aF, line34bC, line34bE,
        line35, line36, line37, line38, line39, line40, line41, line42, line43,
    }
}

// ── The whole schedule ───────────────────────────────────────────────────────

/**
 * A computed Schedule E.
 *
 * **There is deliberately no `filed` field here, and its absence is a
 * decision rather than an omission.** `fjs/schedule/c` carries one, because a
 * break-even business and no business at all produce the same Schedule C of
 * zeros and NOTHING in that record tells them apart — `fjs/form1040/core`
 * genuinely needs it, to keep 1040 line 13a a profile-cited zero. Here the
 * same question is answered by `partII.rows.length`, which is carried out
 * anyway because it IS printed line 28's own table, so a `filed` field would
 * be derivable from a neighbour and read by nothing.
 *
 * A stored field with no reader is exactly the `box13StatutoryEmployee`
 * defect Phase 27 found in `vnd.fjs.w2` and Phase 28 declined to repeat with
 * an SSTB field. This one was written, found unread by mutation, and removed.
 *
 * `selfEmploymentEarningsCents` is carried OUT rather than left inside,
 * because `fjs/schedule/se` line 2 needs it and running this schedule a second
 * time to get it would be the drift `fjs/schedule/se`'s own `SelfEmployment\
 * Outcome` docstring warns about. It is the sum over rows of 1065 box 14 code
 * A, and it is zero for every S-corporation row by construction.
 * `partI` is `fjs/schedule/e/part_i`'s whole record, carried out for the same
 * reason `selfEmploymentEarningsCents` is: `fjs/form1040/core` needs its
 * `alternativeMinimumTaxAdjustmentCents` for Form 6251 line 2l, and re-running
 * Part I to get it would be a SECOND Form 4562 whose mid-quarter convention
 * could disagree with the first's.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly partI: ScheduleEPartI,
 *   readonly partII: ScheduleEPartII,
 *   readonly parts: ScheduleERemainingParts,
 *   readonly selfEmploymentEarningsCents: bigint,
 *   readonly selfEmployedRecipientTin: string | undefined,
 * }} ScheduleE
 */

/** @typedef {ScheduleE | ScheduleERefusal} ScheduleEOutcome */

/**
 * `rentalProperties` and `assetRegisters` are printed Part I's, and they are
 * REQUIRED rather than optional for `beneficiaryRows`' reason: a caller that
 * cannot supply them is a caller that would silently produce a Schedule E
 * missing a landlord's rent. An empty array is the honest way to say "no
 * rental property".
 * @typedef {{
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly rentalProperties: readonly Stored<RentalProperty>[],
 *   readonly assetRegisters: readonly Stored<AssetRegister>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 * }} ScheduleEInput
 */

/**
 * The whole of Schedule E.
 *
 * Partnership rows come before S-corporation rows, which is this engine's own
 * ordering rather than the printed form's — the printed line 28 table is
 * filled in whatever order the taxpayer chooses, and column (b) is what
 * distinguishes the two. Grouping them makes a report readable and changes no
 * total.
 * @type {(input: ScheduleEInput) => ScheduleEOutcome}
 */
export const scheduleE = input => {
    const {
        profile, rentalProperties, assetRegisters,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
    } = input
    // Printed Part I FIRST, because it is the first printed part and because
    // every one of its refusals -- §280A, the loss, Form 4562's own -- must
    // reach a caller before any Part II total is formed.
    const partI = scheduleEPartI({ profile, rentalProperties, assetRegisters })
    if (partI.kind === 'error') {
        return partI
    }
    /** @type {ScheduleERow[]} */
    const rows = []
    /** @type {ScheduleEBeneficiaryRow[]} */
    const beneficiaryRows = []
    for (const document of partnershipK1Forms) {
        const reduced = partnershipRow(document)
        if (reduced.kind === 'error') {
            return reduced
        }
        rows.push(reduced.row)
    }
    for (const document of sCorporationK1Forms) {
        const reduced = sCorporationRow(document)
        if (reduced.kind === 'error') {
            return reduced
        }
        rows.push(reduced.row)
    }
    for (const document of estateTrustK1Forms) {
        const reduced = beneficiaryRow(document)
        if (reduced.kind === 'error') {
            return reduced
        }
        beneficiaryRows.push(reduced.row)
    }
    // Two documents from ONE entity. Checked after the rows are built so the
    // message can name the entity rather than only its identification number,
    // and before any total is formed so the doubled income never exists.
    //
    // The two printed tables are scanned SEPARATELY, and that is a decision
    // rather than convenience: an employer identification number is unique to
    // one entity, but the printed line the pair would have been entered on
    // differs, so the message must name the right table. Scanning them
    // together would also make an estate and a partnership that somehow shared
    // a number refuse under whichever part happened to sort first.
    for (const [index, row] of rows.entries()) {
        const duplicate = rows.findIndex(candidate =>
            candidate.employerIdentificationNumber === row.employerIdentificationNumber)
        if (duplicate !== index) {
            return duplicateEntityRefusal('Schedule E Part II line 28')(row.employerIdentificationNumber)(row.entityName)
        }
    }
    for (const [index, row] of beneficiaryRows.entries()) {
        const duplicate = beneficiaryRows.findIndex(candidate =>
            candidate.employerIdentificationNumber === row.employerIdentificationNumber)
        if (duplicate !== index) {
            return duplicateEntityRefusal('Schedule E Part III line 33')(row.employerIdentificationNumber)(row.entityName)
        }
    }
    const partII = scheduleEPartII(profile)(rows)
    const parts = scheduleERemainingParts(profile)(partI.line26)(partII.line32)(beneficiaryRows)
    // Beneficiary rows are summed in too, and every one contributes its
    // structural zero. Written as a second reduce rather than omitted so that
    // mutating `beneficiaryRow`'s `selfEmploymentEarningsCents = 0n` reddens
    // something -- an omitted term could not.
    const selfEmploymentEarningsCents = rows.reduce(
        (total, row) => total + row.selfEmploymentEarningsCents, 0n)
        + beneficiaryRows.reduce((total, row) => total + row.selfEmploymentEarningsCents, 0n)
    // Whose self-employment earnings these are, for `fjs/schedule/se`'s
    // §1402(b)(1) wage-base attribution -- the base is PER PERSON, so a
    // partner's Forms W-2 must be told from a spouse's. `undefined` when no
    // row carries any earnings at all, which is every S-corporation-only
    // return and every limited-partner one.
    const selfEmployed = rows.find(row => row.selfEmploymentEarningsCents !== 0n)
    return {
        kind: 'ok',
        partI,
        partII,
        parts,
        selfEmploymentEarningsCents,
        selfEmployedRecipientTin: selfEmployed === undefined ? undefined : selfEmployed.recipientTin,
    }
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
const profile = { documentHash: 'profile-hash-e-0001', value: minimalProfileValue }

/**
 * The founder's partnership K-1: a general partner who materially
 * participates, with an $80,000.00 share reported in box 1 and again in box 14
 * code A.
 * @type {(overrides: Partial<K1Partnership>) => Stored<K1Partnership>}
 */
const partnershipDoc = overrides => ({
    documentHash: 'sha256-k1-1065-a',
    value: {
        dialect: 'vnd.fjs.k1_1065',
        payerTin: '33-3333333',
        recipientTin: '222-22-2222',
        accountNumber: 'PTR-0001',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Ventures LP',
        boxGGeneralPartnerOrLlcMemberManager: true,
        materialParticipation: 'materiallyParticipated',
        box1OrdinaryBusinessIncome: '80000.00',
        box14SelfEmploymentEarnings: [{ code: 'A', amount: '80000.00' }],
        ...overrides,
    },
})

/**
 * The SAME $80,000.00 share, in an S corporation. Nothing else differs, which
 * is what criterion 3 asks for.
 * @type {(overrides: Partial<K1SCorporation>) => Stored<K1SCorporation>}
 */
const sCorporationDoc = overrides => ({
    documentHash: 'sha256-k1-1120s-a',
    value: {
        dialect: 'vnd.fjs.k1_1120s',
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'SHR-0001',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Software Inc.',
        materialParticipation: 'materiallyParticipated',
        box1OrdinaryBusinessIncome: '80000.00',
        ...overrides,
    },
})

/**
 * The SAME $80,000.00 share again, this time a beneficiary's — in **box 6**,
 * because on the Form 1041 face box 1 is interest income. Nothing else
 * differs, which is what makes the three-way comparison below a comparison of
 * the *rules* rather than of the amounts.
 * @type {(overrides: Partial<K1EstateTrust>) => Stored<K1EstateTrust>}
 */
const estateTrustDoc = overrides => ({
    documentHash: 'sha256-k1-1041-a',
    value: {
        dialect: 'vnd.fjs.k1_1041',
        payerTin: '66-6666666',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'Northwind Family Trust',
        boxHDomesticBeneficiary: true,
        materialParticipation: 'materiallyParticipated',
        box6OrdinaryBusinessIncome: '80000.00',
        ...overrides,
    },
})

/**
 * ONE `vnd.fjs.rental_property`: a residence let all year with no personal
 * use and $24,000.00 of rent, varied by the overrides.
 * @type {(overrides: Partial<RentalProperty>) => Stored<RentalProperty>}
 */
const rentalPropertyDoc = overrides => ({
    documentHash: 'sha256-rental-a',
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

/** @type {(input: Partial<ScheduleEInput>) => ScheduleEOutcome} */
const run = input => scheduleE({
    profile,
    rentalProperties: [],
    assetRegisters: [],
    partnershipK1Forms: [],
    sCorporationK1Forms: [],
    estateTrustK1Forms: [],
    ...input,
})

/** Narrows an outcome to its OK arm, throwing (never casting).
 * @type {(outcome: ScheduleEOutcome) => ScheduleE}
 */
const ok = outcome => {
    assert(outcome.kind === 'ok', ['expected a computed Schedule E', outcome])
    return outcome
}

/** Narrows an outcome to its refusal arm, throwing (never casting).
 * @type {(outcome: ScheduleEOutcome) => ScheduleERefusal}
 */
const refusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    return outcome
}

/**
 * **The independent statement of the printed Schedule E, part by part**,
 * hand-typed off the 2025 `f1040se.pdf` face: each part, its printed line
 * range, and whether this engine computes it.
 *
 * Deliberately NOT derived from anything in this module. It is the only
 * statement of the computed/refused split that does not come from the code,
 * and `theHandTypedPartTableAgreesWithTheCode` is what compares them.
 * @type {readonly (readonly [string, string, boolean])[]}
 */
const printedPartTable = [
    ['I', 'lines 1-26 (rental real estate and royalties)', true],
    ['II', 'lines 27-32 (partnerships and S corporations)', true],
    ['III', 'lines 33-37 (estates and trusts)', true],
    ['IV', 'lines 38-39 (REMICs)', false],
    ['V', 'lines 40-43 (summary)', false],
]

/** Hand-typed off the printed form: five parts. */
const expectedPartCount = 5
/**
 * Hand-typed: THREE of the five compute. It was `1` until TAX-35 gave
 * `vnd.fjs.k1_1041` a reader — Part III's columns (d) and (f) carry real box 6
 * readings, so Part III joined Part II — and `2` until `vnd.fjs.rental_property`
 * gave printed Part I one. Part I computes a PROFIT and refuses a loss, which
 * is a refusal at the LINE (printed line 21) rather than a part refusal; the
 * distinction is exactly the one Part II already draws, where every K-1 loss
 * refuses and the part still computes.
 */
const expectedComputedPartCount = 3

export const proof = {
    // ── THE REGRESSION CONTROL ───────────────────────────────────────────────
    //
    // A return with no Schedule K-1 at all computes a schedule of documented
    // zeros -- NOT a refusal, and not an absent schedule. This matters more
    // than any other leaf in this file: it is the property that says Phase 30
    // moved nothing for every return that has no pass-through income, which is
    // most of them.
    theReturnWithNoScheduleK1ComputesZerosCitingTheProfile: () => {
        const result = ok(run({}))
        assertEq(result.partII.rows.length, 0, 'no rows, which is how a caller tells this from a break-even entity')
        assertEq(result.partII.line32.value, 0n, 'total partnership and S corporation income $0.00')
        assertEq(result.parts.line41.value, 0n, 'Schedule E line 41 $0.00')
        assertEq(result.selfEmploymentEarningsCents, 0n)
        assertEq(result.selfEmployedRecipientTin, undefined)
        for (const line of [result.partII.line28g, result.partII.line28j, result.parts.line41]) {
            assertEq(line.sources.length, 1)
            assertEq(line.sources[0].documentHash, profile.documentHash)
            assertEq(line.sources[0].boxPath, 'declaredKinds')
        }
    },

    // ── PART I: rental real estate and royalties ─────────────────────────────
    //
    // The arithmetic lives in `fjs/schedule/e/part_i` and is proven there.
    // What is proven HERE is the seam, which that module structurally cannot
    // see: printed line 26 reaching printed line 41, and a Part I refusal
    // reaching a caller of `scheduleE` with its content intact.
    partI: {
        /**
         * ★ **THE LEAF A SURVIVING MUTATION DEMANDED.** Replacing this
         * module's Part I error arm with `{ ...partI, message: '' }` — a
         * refusal that fires, propagates, and says NOTHING — left the entire
         * suite green. `fjs/schedule/e/part_i`'s own refusal leaves call that
         * module directly and never travel through this one, so nothing
         * asserted that a Part I refusal survives the trip.
         *
         * Two refusals with two different subjects are checked, so a seam that
         * happened to carry one message correctly cannot pass.
         */
        aPartIRefusalReachesAScheduleECallerWithItsContentIntact: () => {
            const loss = run({
                rentalProperties: [rentalPropertyDoc({
                    rentsReceived: '1000.00',
                    entries: [{
                        category: 'repairs',
                        datePaid: '2025-05-02',
                        description: 'boiler repair',
                        amount: '1500.00',
                    }],
                })],
            })
            assert(loss.kind === 'error', ['a rental loss must refuse through Schedule E', loss])
            if (loss.kind !== 'error') {
                return
            }
            assert(loss.message.includes('Form 8582'),
                ['the form the filer needs must survive the seam', loss.message])
            assert(loss.message.includes('RENT-0001'),
                ['and the property it is about', loss.message])
            const personalUse = run({
                rentalProperties: [rentalPropertyDoc({ fairRentalDays: 100, personalUseDays: 30 })],
            })
            assert(personalUse.kind === 'error', ['a §280A property must refuse through Schedule E', personalUse])
            if (personalUse.kind !== 'error') {
                return
            }
            assert(personalUse.message.includes('\u00a7280A(c)(5)'),
                ['a DIFFERENT Part I refusal must survive the seam too', personalUse.message])
            assert(!personalUse.message.includes('Form 8582'),
                ['and it must not be the loss refusal wearing another name', personalUse.message])
        },
        /**
         * ★ **THE SEAM ITSELF**: printed line 26 IS a summand of printed line
         * 41, and line 41 is what `fjs/schedule/1` reads into line 5. A
         * profitable property beside a partnership K-1 proves both halves are
         * carried rather than one replacing the other.
         *
         * Hand-typed: rents $24,000.00 less $1,500.00 of repairs is printed
         * line 26 = **$22,500.00**; the partnership's box 1 is $80,000.00 on
         * printed line 32; line 41 combines them at **$102,500.00**.
         */
        printedLineTwentySixIsASummandOfPrintedLineFortyOne: () => {
            const result = ok(run({
                rentalProperties: [rentalPropertyDoc({
                    entries: [{
                        category: 'repairs',
                        datePaid: '2025-05-02',
                        description: 'boiler repair',
                        amount: '1500.00',
                    }],
                })],
                partnershipK1Forms: [partnershipDoc({})],
            }))
            assertEq(result.partI.line26.value, 2250000n, 'Schedule E line 26 $22,500.00')
            assertEq(result.parts.line26.value, 2250000n, 'and the summary carries the SAME line 26')
            assertEq(result.partII.line32.value, 8000000n, 'Schedule E line 32 $80,000.00')
            assertEq(result.parts.line41.value, 10250000n, 'line 41 = 26 + 32 + 37 + 39 + 40')
            // THE CONTROL: the same partnership with no property. Line 41 is
            // the partnership share alone, so the leaf above is evidence about
            // line 26 rather than about line 32.
            const withoutProperty = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            assertEq(withoutProperty.partI.line26.value, 0n)
            assertEq(withoutProperty.parts.line41.value, 8000000n)
        },
    },

    // ── PART III: the reader `vnd.fjs.k1_1041` did not have (TAX-35) ─────────
    partIII: {
        /**
         * **THE MOVES-BY-EXACTLY FIXTURE.** A beneficiary who materially
         * participated: box 6's $80,000.00 lands in printed column (f), reaches
         * line 35, line 37 and line 41, and every figure is hand-typed in cents
         * rather than derived from the input.
         *
         * Arithmetic a reader can check: 80,000.00 -> 8,000,000 cents. Column
         * (d) is $0.00 because the row is nonpassive, so line 35 = (d) + (f) =
         * 0 + 8,000,000. Line 36 = -((c) + (e)) = -0. Line 37 = 8,000,000 + 0.
         * Line 41 = 26 + 32 + 37 + 39 + 40 = 0 + 0 + 8,000,000 + 0 + 0.
         */
        materiallyParticipatingBeneficiaryReachesColumnFAndLineFortyOne: () => {
            const result = ok(run({ estateTrustK1Forms: [estateTrustDoc({})] }))
            const { parts } = result
            assertEq(parts.beneficiaryRows.length, 1)
            assertEq(parts.line33d.value, 0n, 'nonpassive, so column (d) is empty')
            assertEq(parts.line33f.value, 8000000n, 'column (f) carries box 6')
            assertEq(parts.line33c.value, 0n)
            assertEq(parts.line33e.value, 0n)
            assertEq(parts.line35.value, 8000000n, 'line 35 = columns (d) + (f) of line 34a')
            assertEq(parts.line36.value, 0n)
            assertEq(parts.line37.value, 8000000n, 'line 37 -> Schedule 1 line 5')
            assertEq(parts.line41.value, 8000000n, 'line 41 = 26 + 32 + 37 + 39 + 40')
            // The CITATION, not merely the amount: the figure must be traceable
            // to the stored box it came from, or a reader cannot check it.
            assertEq(parts.line33f.sources.length, 1)
            assertEq(parts.line33f.sources[0].documentHash, 'sha256-k1-1041-a')
            assertEq(parts.line33f.sources[0].boxPath, 'box6OrdinaryBusinessIncome')
            assertEq(parts.line33f.sources[0].value, '80000.00')
            // Part II is untouched -- a beneficiary is not a partner, and a row
            // that leaked into printed line 28 would show up here.
            assertEq(result.partII.rows.length, 0)
            assertEq(result.partII.line32.value, 0n)
        },

        /**
         * **THE DOES-NOT-MOVE CONTROL.** The identical run with no Schedule
         * K-1 (Form 1041) leaves every Part III line at zero, CITING THE
         * PROFILE rather than a document. Without this, a Part III that
         * carried $80,000.00 unconditionally would satisfy the leaf above.
         */
        controlNoEstateOrTrustK1LeavesPartIIIAtProfileCitedZeros: () => {
            const { parts } = ok(run({}))
            assertEq(parts.beneficiaryRows.length, 0)
            for (const line of [parts.line33c, parts.line33d, parts.line33e, parts.line33f, parts.line37]) {
                assertEq(line.value, 0n)
            }
            for (const line of [parts.line33d, parts.line33f]) {
                assertEq(line.sources.length, 1)
                assertEq(line.sources[0].documentHash, profile.documentHash)
                assertEq(line.sources[0].boxPath, 'declaredKinds')
            }
        },

        /**
         * The §469 column is a determination, not a default: a beneficiary who
         * did NOT materially participate goes in column (d) — and then the
         * §1411(c)(6) gate bites, because their self-employment term is zero by
         * construction. So the passive case REFUSES rather than computing, and
         * the refusal is the pre-existing one reached one layer later.
         */
        theNonMateriallyParticipatingBeneficiaryIsRefusedByTheSection1411Gate: () => {
            const message = refusal(run({
                estateTrustK1Forms: [estateTrustDoc({ materialParticipation: 'didNotMateriallyParticipate' })],
            })).message
            assert(message.includes('§1411(c)(6)'), ['expected the net investment income gate', message])
            assert(message.includes('Northwind Family Trust'), ['a refusal must name the entity', message])
        },

        /** An ABSENT determination refuses by name, and names Part III's own
         * printed columns rather than Part II's four. */
        anUnstatedDeterminationRefusesNamingPartIIIsOwnColumns: () => {
            const message = refusal(run({
                estateTrustK1Forms: [estateTrustDoc({ materialParticipation: undefined })],
            })).message
            assert(message.includes('Schedule E Part III line 33'), ['expected Part III named', message])
            assert(message.includes('estate or trust'), ['expected the entity kind named', message])
            assert(message.includes('column (d) or (f)'), ['expected page 2\'s own destination quoted', message])
            assert(!message.includes('(h, i and j)'), ['Part II\'s columns must not appear', message])
        },

        /**
         * **A LOSS refuses under §642(h)/§643, and NOT under §704(d).** The
         * negative assertion is the load-bearing half: citing a partner's basis
         * limitation at a beneficiary would be a plausible-looking wrong answer,
         * and only asserting its ABSENCE can catch it.
         */
        aLossRefusesUnderSection642hAndNotSection704d: () => {
            const message = refusal(run({
                estateTrustK1Forms: [estateTrustDoc({ box6OrdinaryBusinessIncome: '-12345.67' })],
            })).message
            assert(message.includes('§642(h)'), ['expected §642(h)', message])
            assert(message.includes('§643(a)'), ['expected §643(a)', message])
            assert(message.includes('BOX 11'), ['a §642(h) loss arrives in box 11; say so', message])
            // Part II's basis limitations appear only inside an explicit
            // DISCLAIMER, and the disclaimer is the load-bearing part: a
            // reader who knows Part II's rule needs to be told it does not
            // apply here, and a message that cited §704(d) as the REASON would
            // pass a bare "mentions §642(h)" check.
            assert(
                message.includes('deliberately not §704(d)\'s or §1366(d)\'s basis limitation'),
                ['the partner and shareholder basis limitations must be disclaimed by name', message])
            assert(
                message.includes('neither statute reaches a beneficiary'),
                ['the disclaimer must say why', message])
            // The amount, so a reader can tell which document is wrong.
            assert(message.includes('1234567'), ['expected the loss in cents', message])
        },

        /**
         * Every one of the FIVE coded boxes refuses a non-zero amount by name,
         * naming §652(b)/§662(b) rather than a partner's or shareholder's
         * separate-statement rule. Hand-typed count beside the loop, so a box
         * dropped from `estateTrustCodedBoxes` fails here even though the loop
         * would happily iterate one fewer.
         *
         * **The CODE is per box, and box 12's is `G` rather than `A`.** Box 12
         * code A is Form 6251 line 2j and is now routed, so driving this box
         * with `A` would be driving it with the one code the sweep is supposed
         * to let past — the leaf would then be asserting the opposite of the
         * rule. `G` is accelerated depreciation, a Form 6251 line 2l item this
         * engine holds at a documented zero, and it still refuses. The pair
         * below (`boxTwelveCodeAIsRoutedAndEveryOtherCodeRefuses`) is where the
         * routed code is proved separately.
         */
        allFiveCodedBoxesRefuseByNameCitingSection652b: () => {
            /** @type {readonly (readonly [keyof K1EstateTrust, string, string])[]} */
            const codedBoxes = [
                ['box9DirectlyApportionedDeductions', 'box 9', 'A'],
                ['box11FinalYearDeductions', 'box 11', 'A'],
                ['box12AlternativeMinimumTaxItems', 'box 12', 'G'],
                ['box13CreditsAndCreditRecapture', 'box 13', 'A'],
                ['box14OtherInformation', 'box 14', 'A'],
            ]
            assertEq(codedBoxes.length, 5, 'the printed Form 1041 K-1 has five coded boxes')
            for (const [field, printedBox, code] of codedBoxes) {
                const message = refusal(run({
                    estateTrustK1Forms: [estateTrustDoc({ [field]: [{ code, amount: '500.00' }] })],
                })).message
                assert(message.includes(printedBox), ['a coded refusal must name its printed box', printedBox, message])
                assert(message.includes('§652(b)/§662(b)'), ['expected the beneficiary statute', printedBox, message])
                assert(message.includes('Schedule E Part III'), ['expected Part III named', printedBox, message])
                assert(!message.includes('§702(a)'), ['a partner\'s statute must not appear', printedBox, message])
                assert(!message.includes('§1366(a)(1)'), ['a shareholder\'s statute must not appear', printedBox, message])
            }
            // The CONTROL: a ZERO coded amount is not a refusal, so the sweep is
            // not simply refusing every coded box that exists.
            assertEq(
                ok(run({
                    estateTrustK1Forms: [estateTrustDoc({
                        box14OtherInformation: [{ code: 'A', amount: '0.00' }],
                    })],
                })).parts.line33f.value,
                8000000n,
            )
        },

        /**
         * **The gate this schedule opened for Form 6251 line 2j, and its
         * control.** Box 12 code A is routed — the beneficiary's row still
         * computes, and the $80,000.00 share still reaches line 33 column (f)
         * beside it — while box 12's other NINE codes still refuse by name.
         *
         * The nine codes are HAND-TYPED here and NOT read from `line2jCodes`,
         * per AGENTS.md: a list derived from the code under test cannot notice
         * itself growing. Adding any of them to the routed list reddens this
         * leaf and `fjs/form6251/estate_trust`'s own arithmetic leaf together.
         *
         * A gate that let EVERY code through would pass the first half of this
         * leaf and fail the second; a gate that let NONE through — the state
         * before this work — fails the first.
         */
        boxTwelveCodeAIsRoutedAndEveryOtherCodeRefuses: () => {
            // Routed: no refusal, and the rest of the row is untouched.
            const routed = ok(run({
                estateTrustK1Forms: [estateTrustDoc({
                    box12AlternativeMinimumTaxItems: [{ code: 'A', amount: '75000.00' }],
                })],
            }))
            assertEq(routed.parts.beneficiaryRows.length, 1, 'the beneficiary row still computes')
            assertEq(
                routed.parts.line33f.value, 8000000n,
                'and box 6\'s $80,000.00 still reaches column (f) beside the AMT item')
            /** @type {readonly string[]} */
            const stillRefused = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
            assertEq(stillRefused.length, 9, 'box 12 prints ten codes and exactly one of them is line 2j')
            for (const code of stillRefused) {
                const message = refusal(run({
                    estateTrustK1Forms: [estateTrustDoc({
                        box12AlternativeMinimumTaxItems: [{ code, amount: '500.00' }],
                    })],
                })).message
                assert(message.includes('box 12'), ['name the printed box', code, message])
                assert(message.includes(code), ['name the code that refused', code, message])
            }
        },

        /**
         * **The gate is the STRICTER of the two code matchers, deliberately.**
         * `codedBoxSweep` compares the RAW string and is shared by all three
         * K-1 faces, so a lower-cased `' a '` does not match `line2jCodes` here
         * and the whole return refuses — before Form 6251, whose own matcher
         * trims and upper-cases, ever sums it.
         *
         * The asymmetry is safe in exactly one direction and this leaf is what
         * pins the direction: every code the sweep passes the reader also sums,
         * so nothing is silently dropped; and a spelling the sweep does not
         * recognise cannot reach a computed line at all. Loosening the sweep
         * instead would loosen the 1065 box 14 code A read, where a `'a'` would
         * pass the sweep and then be MISSED by
         * {@link selfEmploymentEarningsForRow} — self-employment earnings
         * silently zero, an understatement.
         */
        aLowerCaseCodeStillRefusesAtTheGate: () => {
            const message = refusal(run({
                estateTrustK1Forms: [estateTrustDoc({
                    box12AlternativeMinimumTaxItems: [{ code: ' a ', amount: '75000.00' }],
                })],
            })).message
            assert(message.includes('box 12'), ['name the printed box', message])
            // The CONTROL: the same document with the code as PRINTED is
            // routed, so this is not a sweep that refuses box 12 outright.
            assertEq(
                ok(run({
                    estateTrustK1Forms: [estateTrustDoc({
                        box12AlternativeMinimumTaxItems: [{ code: 'A', amount: '75000.00' }],
                    })],
                })).parts.beneficiaryRows.length,
                1)
        },

        /**
         * **A beneficiary's share is NEVER self-employment income.** The
         * structural zero, asserted through the figure `fjs/schedule/se` line 2
         * actually reads — so mutating `beneficiaryRow`'s `0n` reddens here.
         */
        theBeneficiaryAddsNoSelfEmploymentEarnings: () => {
            const alone = ok(run({ estateTrustK1Forms: [estateTrustDoc({})] }))
            assertEq(alone.selfEmploymentEarningsCents, 0n, '§1402(a) does not reach a beneficiary')
            assertEq(alone.selfEmployedRecipientTin, undefined)
            // Beside a GENERAL PARTNER, whose $80,000.00 IS self-employment
            // income: the total must be the partner's alone. A beneficiary that
            // wrongly contributed would double it, and this is the pairing that
            // tells "zero" apart from "not summed at all".
            const beside = ok(run({
                partnershipK1Forms: [partnershipDoc({})],
                estateTrustK1Forms: [estateTrustDoc({})],
            }))
            assertEq(beside.selfEmploymentEarningsCents, 8000000n, 'the partner\'s share only')
            assertEq(beside.parts.line41.value, 16000000n, 'line 32 $80,000.00 + line 37 $80,000.00')
        },

        /** Two Schedule K-1s from ONE estate refuse, naming PART III's printed
         * line rather than Part II's — the message a reader acts on. */
        twoK1sFromOneEstateRefuseNamingPartIIIsPrintedLine: () => {
            const message = refusal(run({
                estateTrustK1Forms: [estateTrustDoc({}), estateTrustDoc({})],
            })).message
            assert(message.includes('Schedule E Part III line 33'), ['expected Part III line 33', message])
            assert(!message.includes('Part II line 28'), ['the wrong printed table was named', message])
            assert(message.includes('66-6666666'), ['expected the shared identification number', message])
        },
    },

    printedForm: {
        /**
         * THE COMPARISON: the hand-typed printed part table against what this
         * module actually does. Three of the five parts have a named refusal
         * function and the other two do not — because they are the two that
         * compute.
         *
         * MERGE NOTE / TAX-35: Part III moved from the refusal side to the
         * computing side, and `partIIIEstatesAndTrusts` was DELETED rather than
         * left standing. A part refusal that no longer refuses is worse than
         * none: it reads as this engine's stated position while the code has
         * the opposite one.
         *
         * The Schedule E Part I wiring did the same to
         * `partIRentalRealEstateAndRoyalties`, for the same reason and by the
         * same rule. Part I's refusals now live at the LINE
         * (`fjs/schedule/e/part_i`'s §280A, loss and category refusals), which
         * is where a refusal belongs once the part around it computes.
         */
        theHandTypedPartTableAgreesWithTheCode: () => {
            assertEq(printedPartTable.length, expectedPartCount)
            assertEq(
                printedPartTable.filter(([, , computes]) => computes).length,
                expectedComputedPartCount,
                'exactly three printed parts compute',
            )
            /** @type {Record<string, () => ScheduleERefusal>} */
            const refusalForPart = {
                IV: partIVRealEstateMortgageInvestmentConduits,
                V: partVNetFarmRentalIncomeLine40,
            }
            for (const [part, lines, computes] of printedPartTable) {
                const named = refusalForPart[part]
                assertEq(
                    named === undefined,
                    computes,
                    ['a part that computes must have no refusal function, and vice versa', part, lines],
                )
                if (named === undefined) {
                    continue
                }
                const result = named()
                assertEq(result.kind, 'error')
                assert(
                    result.message.includes(`Schedule E Part ${part}`),
                    ['a part refusal must name its own printed part', part, result.message])
            }
        },

        /**
         * Every part refusal names a FORM, a SECTION or a fact a reader can
         * act on — never merely "not supported". AGENTS.md's finding about
         * `${destination}`: assert the part of the message that carries the
         * information.
         */
        everyPartRefusalNamesWhatIsMissing: () => {
            /** @type {readonly (readonly [() => ScheduleERefusal, string])[]} */
            const expected = [
                [partIVRealEstateMortgageInvestmentConduits, 'Form 1066'],
                [partVNetFarmRentalIncomeLine40, 'Form 4835'],
            ]
            assertEq(expected.length, 2, 'two printed parts refuse')
            for (const [named, form] of expected) {
                const message = named().message
                assert(message.includes(form), ['a part refusal must name the form it needs', form, message])
                assert(message.includes('no phase yet'), ['a part refusal must say it is not scheduled', message])
            }
        },

        /**
         * **Line 41 combines exactly the five printed lines the instruction
         * names**, and each of the four zeros is a summand rather than a
         * dropped line — so the day any of the four starts computing, line 41
         * already carries it.
         *
         * The check is arithmetic rather than textual: the printed
         * instruction's own five line numbers are read off the page and each
         * of the five lines' VALUES is asserted, so a summand dropped from the
         * addition shows up as an inequality rather than as a missing name.
         */
        lineFortyOneCombinesTheFivePrintedLines: () => {
            const result = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            const { parts } = result
            assertEq(
                parts.line41.value,
                parts.line26.value + result.partII.line32.value + parts.line37.value
                + parts.line39.value + parts.line40.value,
                'line 41 = lines 26 + 32 + 37 + 39 + 40')
            // ...and the four that are zero really are zero, asserted
            // individually so a line quietly gaining a value is not absorbed
            // by the total.
            assertEq(parts.line26.value, 0n, 'Part I line 26')
            assertEq(parts.line37.value, 0n, 'Part III line 37')
            assertEq(parts.line39.value, 0n, 'Part IV line 39')
            assertEq(parts.line40.value, 0n, 'Part V line 40')
            assertEq(parts.line41.value, 8000000n, '$80,000.00')
        },

        /**
         * Lines 42 and 43 are RECONCILIATIONS and are summands of nothing.
         * Without this, adding either to line 41 "for completeness" would
         * double-count a figure already inside it.
         */
        theTwoReconciliationLinesFeedNothing: () => {
            const { parts, partII } = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            assertEq(parts.line42.value, 0n)
            assertEq(parts.line43.value, 0n)
            assertEq(
                parts.line41.value,
                partII.line32.value,
                'line 41 is Part II alone here, so neither reconciliation is inside it')
        },
    },

    partII: {
        /**
         * **A materially-participating general partner's $80,000.00 lands in
         * column (j), and NOT in column (g)** — the transposition no total
         * could notice, because line 30 adds both.
         */
        nonpassiveIncomeLandsInColumnJAndNotColumnG: () => {
            const { partII } = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            assertEq(partII.line28j.value, 8000000n, '$80,000.00 in the NONPASSIVE column')
            assertEq(partII.line28g.value, 0n, 'and nothing in the passive column')
            assertEq(partII.line29aJ.value, 8000000n)
            assertEq(partII.line29aG.value, 0n)
            assertEq(partII.line30.value, 8000000n, 'line 30 adds columns (g) and (j)')
            assertEq(partII.line31.value, 0n, 'no losses and no §179')
            assertEq(partII.line32.value, 8000000n, 'line 32 = line 30 + line 31')
            // The row itself records the column, so a report can print it.
            assertEq(partII.rows.length, 1)
            assertEq(partII.rows[0]?.passive, false)
            assertEq(partII.rows[0]?.entityType, 'P')
        },

        /**
         * **THE CONTROL for the §1411(c)(6) gate**, and the case that proves
         * the passive column is reachable rather than decorative: a general
         * partner who did NOT materially participate is PASSIVE, and computes
         * — because the whole of the share is box 14 code A self-employment
         * income, which §1411(c)(6) takes back out of net investment income.
         *
         * Column (g) carries it and column (j) does not, which is the
         * transposition the total cannot see.
         */
        aPassiveGeneralPartnerLandsInColumnGAndStillComputes: () => {
            const { partII, selfEmploymentEarningsCents } = ok(run({
                partnershipK1Forms: [partnershipDoc({
                    materialParticipation: 'didNotMateriallyParticipate',
                })],
            }))
            assertEq(partII.line28g.value, 8000000n, '$80,000.00 in the PASSIVE column')
            assertEq(partII.line28j.value, 0n, 'and nothing in the nonpassive column')
            assertEq(partII.line32.value, 8000000n, 'the total is the same either way')
            // ...and the self-employment tax is charged all the same: §1402(a)
            // has no material-participation test.
            assertEq(selfEmploymentEarningsCents, 8000000n)
        },

        /**
         * A LIMITED partner is passive by §469(h)(2) with no assertion at all,
         * and their share is NOT self-employment income — so §1411(c)(6)
         * covers none of it and the return refuses, naming Form 8960 line 4a.
         *
         * This is the gate whose control is the leaf above.
         */
        aLimitedPartnersPassiveIncomeRefusesNamingFormEightNineSixty: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    boxGGeneralPartnerOrLlcMemberManager: undefined,
                    boxGLimitedPartnerOrOtherLlcMember: true,
                    materialParticipation: undefined,
                    box14SelfEmploymentEarnings: undefined,
                })],
            }))
            assert(result.message.includes('Form 8960 line 4a'), [result.message])
            assert(result.message.includes('§1411(c)(2)(A)'), [result.message])
            assert(result.message.includes('§1411(c)(6)'), [result.message])
            // The message must name the ENTITY and the amount, or a filer with
            // two K-1s cannot tell which one stopped the return.
            assert(result.message.includes('Northwind Ventures LP'), [result.message])
            assert(result.message.includes('8000000'), [result.message])
        },

        /** The same gate for an S-corporation shareholder who did not participate. */
        aPassiveShareholdersIncomeRefusesToo: () => {
            const result = refusal(run({
                sCorporationK1Forms: [sCorporationDoc({
                    materialParticipation: 'didNotMateriallyParticipate',
                })],
            }))
            assert(result.message.includes('Form 8960 line 4a'), [result.message])
            assert(result.message.includes('Northwind Software Inc.'), [result.message])
        },

        /**
         * **The §469 determination is not optional and not defaulted.** A
         * general partner who states neither answer refuses by name.
         */
        anUnstatedMaterialParticipationRefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({ materialParticipation: undefined })],
            }))
            assert(result.message.includes('materialParticipation'), [result.message])
            assert(result.message.includes('§469(h)(1)'), [result.message])
            assert(result.message.includes('materiallyParticipated'), [result.message])
            assert(result.message.includes('didNotMateriallyParticipate'), [result.message])
            assert(result.message.includes('partnership'), [result.message])
        },

        /** The same for an S-corporation shareholder, whose message says "S corporation". */
        anUnstatedShareholderDeterminationRefusesNamingTheEntityKind: () => {
            const result = refusal(run({
                sCorporationK1Forms: [sCorporationDoc({ materialParticipation: undefined })],
            }))
            assert(result.message.includes('S corporation'), [result.message])
            assert(!result.message.includes('this partnership'), [result.message])
        },

        /**
         * **Two entities BOTH reach line 32**, and each is cited — the leaf a
         * single-document proof could not distinguish from a "read the first
         * one" bug. Schedule E is a table, unlike Schedule C.
         *
         * $80,000.00 + $30,000.00 = $110,000.00, hand-added.
         */
        twoEntitiesBothReachLineThirtyTwoCitingEach: () => {
            const { partII, parts } = ok(run({
                partnershipK1Forms: [partnershipDoc({})],
                sCorporationK1Forms: [sCorporationDoc({ box1OrdinaryBusinessIncome: '30000.00' })],
            }))
            assertEq(partII.rows.length, 2)
            assertEq(partII.line28j.value, 11000000n, '$80,000.00 + $30,000.00 = $110,000.00')
            assertEq(parts.line41.value, 11000000n)
            assertEq(partII.line28j.sources.length, 2)
            const [first, second] = partII.line28j.sources
            assert(second !== undefined, ['two K-1s must yield two sources', partII.line28j.sources])
            assertEq(first.documentHash, 'sha256-k1-1065-a')
            assertEq(second.documentHash, 'sha256-k1-1120s-a')
            assertEq(first.boxPath, 'box1OrdinaryBusinessIncome')
            // The two printed column (b) values are BOTH present, which is what
            // makes the table a table.
            assertEq(partII.rows[0]?.entityType, 'P')
            assertEq(partII.rows[1]?.entityType, 'S')
        },

        /**
         * Two Schedule K-1s from ONE entity refuse — a duplicate, or an
         * original and its correction, and this engine can tell neither from
         * the other because `corrected` is read by nothing.
         */
        twoScheduleK1sFromOneEntityRefuse: () => {
            const result = refusal(run({
                partnershipK1Forms: [
                    partnershipDoc({}),
                    { ...partnershipDoc({}), documentHash: 'sha256-k1-1065-b' },
                ],
            }))
            assert(result.message.includes('33-3333333'), ['the refusal must name the EIN', result.message])
            assert(result.message.includes('Northwind Ventures LP'), [result.message])
            assert(result.message.includes('corrected'), [result.message])
        },

        /**
         * THE CONTROL for the leaf above: two DIFFERENT partnerships are
         * ordinary and must compute. Without it, a duplicate check that
         * refused every second K-1 would pass.
         */
        twoDifferentPartnershipsCompute: () => {
            const { partII } = ok(run({
                partnershipK1Forms: [
                    partnershipDoc({}),
                    {
                        ...partnershipDoc({
                            payerTin: '55-5555555',
                            payerName: 'Southwind Capital LP',
                            box1OrdinaryBusinessIncome: '12000.00',
                            box14SelfEmploymentEarnings: [{ code: 'A', amount: '12000.00' }],
                        }),
                        documentHash: 'sha256-k1-1065-b',
                    },
                ],
            }))
            assertEq(partII.line32.value, 9200000n, '$80,000.00 + $12,000.00 = $92,000.00')
        },

        /** Printed line 27 is a documented NO, and it is a field rather than prose. */
        lineTwentySevenIsADocumentedNo: () => {
            assertEq(ok(run({ partnershipK1Forms: [partnershipDoc({})] })).partII.line27, false)
        },
    },

    selfEmployment: {
        /**
         * **CRITERION 3, priced.** Two returns whose ONLY difference is the
         * entity type: an $80,000.00 general-partner share and an $80,000.00
         * S-corporation share. The Schedule E figure is identical; the
         * self-employment earnings are $80,000.00 and $0.00.
         *
         * Both figures asserted, as the criterion asks — and the equality of
         * the Schedule E halves is asserted too, because it is what makes
         * "the only difference is the entity type" a checked claim rather than
         * a description of the fixtures.
         */
        theOnlyDifferenceIsTheEntityTypeAndTheSelfEmploymentEarningsDiffer: () => {
            const partner = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            const shareholder = ok(run({ sCorporationK1Forms: [sCorporationDoc({})] }))
            // The halves that must be the SAME.
            assertEq(partner.parts.line41.value, 8000000n, '$80,000.00 to Schedule 1 line 5')
            assertEq(shareholder.parts.line41.value, 8000000n, 'the same $80,000.00')
            assertEq(partner.partII.line28j.value, shareholder.partII.line28j.value)
            // The halves that must DIFFER. §1402(a) against Rev. Rul. 59-221.
            assertEq(partner.selfEmploymentEarningsCents, 8000000n, 'a general partner: $80,000.00')
            assertEq(shareholder.selfEmploymentEarningsCents, 0n, 'a shareholder: $0.00, never')
            assertEq(partner.selfEmployedRecipientTin, '222-22-2222')
            assertEq(shareholder.selfEmployedRecipientTin, undefined)
        },

        /**
         * A general partner with box 1 income and NO box 14 code A refuses:
         * printed Schedule SE line 2 asks for that box by name and box 1 is
         * not a substitute.
         */
        aGeneralPartnerWithoutCodeARefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({ box14SelfEmploymentEarnings: undefined })],
            }))
            assert(result.message.includes('box 14 code A'), [result.message])
            assert(result.message.includes('§1402(a)'), [result.message])
            assert(result.message.includes('15.3%'), ['the refusal must state the size of the error', result.message])
        },

        /**
         * THE CONTROL: a general partner with NO income and no code A is an
         * ordinary dormant-partnership K-1 and must compute. Without it, the
         * refusal above could be a blanket ban on a missing box 14.
         */
        aGeneralPartnerWithNoIncomeAndNoCodeAComputes: () => {
            const result = ok(run({
                partnershipK1Forms: [partnershipDoc({
                    box1OrdinaryBusinessIncome: undefined,
                    box14SelfEmploymentEarnings: undefined,
                })],
            }))
            assertEq(result.parts.line41.value, 0n)
            assertEq(result.selfEmploymentEarningsCents, 0n)
            // ...and it has a ROW, unlike the no-document case: a dormant
            // partnership is not the same as no partnership, and the row is
            // the only thing that says so.
            assertEq(result.partII.rows.length, 1)
        },

        /** Code A disagreeing with box 1 refuses, naming both figures. */
        aCodeAThatDisagreesWithBoxOneRefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    box14SelfEmploymentEarnings: [{ code: 'A', amount: '75000.00' }],
                })],
            }))
            assert(result.message.includes('7500000'), ['the refusal must name code A', result.message])
            assert(result.message.includes('8000000'), ['the refusal must name box 1', result.message])
            assert(result.message.includes('guaranteed payments'), [result.message])
        },

        /** A LIMITED partner with a code A refuses, naming §1402(a)(13). */
        aLimitedPartnerWithCodeARefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    boxGGeneralPartnerOrLlcMemberManager: undefined,
                    boxGLimitedPartnerOrOtherLlcMember: true,
                    materialParticipation: undefined,
                })],
            }))
            assert(result.message.includes('§1402(a)(13)'), [result.message])
            assert(result.message.includes('box 4a'), [result.message])
        },

        /**
         * **Box 14 codes B and C do NOT refuse**, and this is the leaf that
         * pins the one documented exception to the coded sweep. They are gross
         * farming/fishing and gross non-farm income, read by nothing because
         * Schedule SE Part II's optional methods are refused outright.
         */
        boxFourteenCodesBAndCAreDocumentedNotRefused: () => {
            const result = ok(run({
                partnershipK1Forms: [partnershipDoc({
                    box14SelfEmploymentEarnings: [
                        { code: 'A', amount: '80000.00' },
                        { code: 'B', amount: '0.00' },
                        { code: 'C', amount: '95000.00' },
                    ],
                })],
            }))
            assertEq(result.selfEmploymentEarningsCents, 8000000n, 'only code A is read')
            assertEq(result.parts.line41.value, 8000000n, 'and code C is not added to anything')
        },

        /** ...but any OTHER box 14 code refuses, so the exception is exactly two codes. */
        anotherBoxFourteenCodeRefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    box14SelfEmploymentEarnings: [
                        { code: 'A', amount: '80000.00' },
                        { code: 'D', amount: '500.00' },
                    ],
                })],
            }))
            assert(result.message.includes('box 14 code D'), [result.message])
        },
    },

    losses: {
        /**
         * A negative box 1 refuses, naming all THREE limitations — and the
         * partnership message names §704(d) while the S-corporation one names
         * §1366(d), which is the difference a shared message would lose.
         */
        aPartnershipLossRefusesNamingSevenOhFourD: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    box1OrdinaryBusinessIncome: '-12000.00',
                    box14SelfEmploymentEarnings: [{ code: 'A', amount: '-12000.00' }],
                })],
            }))
            assert(result.message.includes('§704(d)'), [result.message])
            assert(result.message.includes('§465'), [result.message])
            assert(result.message.includes('§469'), [result.message])
            assert(result.message.includes('Form 6198'), [result.message])
            assert(result.message.includes('Form 8582'), [result.message])
            assert(result.message.includes('1200000'), ['the refusal must name the loss', result.message])
            // The §704(b) capital account is NOT tax basis, and saying so is
            // the part a reader holding a K-1 needs: item L looks exactly like
            // the number the refusal says is missing.
            assert(result.message.includes('§704(b)'), [result.message])
        },

        aShareholderLossRefusesNamingThirteenSixtySixD: () => {
            const result = refusal(run({
                sCorporationK1Forms: [sCorporationDoc({ box1OrdinaryBusinessIncome: '-12000.00' })],
            }))
            assert(result.message.includes('§1366(d)'), [result.message])
            assert(result.message.includes('debt'), ['a shareholder has debt basis too', result.message])
            assert(!result.message.includes('§704(d)'), ['a shareholder is not a partner', result.message])
        },

        /**
         * **A loss refuses even beside a profit**, which is the per-row rule
         * and the one place this decision goes further than Schedule C's:
         * netting one entity's loss against another's profit before testing
         * either is the arithmetic §704(d) and §1366(d) exist to stop. The
         * combined line 32 here would be a positive $68,000.00, so a
         * total-level check would compute happily.
         */
        aLossRefusesEvenWhenTheCombinedTotalIsAProfit: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({})],
                sCorporationK1Forms: [sCorporationDoc({ box1OrdinaryBusinessIncome: '-12000.00' })],
            }))
            assert(result.message.includes('§1366(d)'), [result.message])
            assert(result.message.includes('Northwind Software Inc.'), [result.message])
        },

        /** A break-even ZERO computes, exactly as `fjs/schedule/c`'s line 31 does. */
        aBreakEvenZeroComputes: () => {
            const result = ok(run({
                sCorporationK1Forms: [sCorporationDoc({ box1OrdinaryBusinessIncome: '0.00' })],
            }))
            assertEq(result.parts.line41.value, 0n)
            assertEq(
                result.partII.rows.length,
                1,
                'a break-even entity still has a row; only that tells it from no entity at all')
        },
    },

    section199A: {
        /**
         * 1065 box 20 code Z PRESENT refuses, naming the four components of
         * the attached statement and Reg. §1.199A-6(b)(3)(iii)'s opposite
         * rule for the absent case.
         */
        aPresentCodeZRefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    box20OtherInformation: [{ code: 'Z' }],
                })],
            }))
            assert(result.message.includes('box 20 code Z'), [result.message])
            assert(result.message.includes('STMT'), [result.message])
            assert(result.message.includes('§1.199A-6(b)(3)(iii)'), [result.message])
            assert(result.message.includes('Form 8995-A'), [result.message])
        },

        /** 1120-S box 17 code V, the same rule under a different box number. */
        aPresentCodeVRefuses: () => {
            const result = refusal(run({
                sCorporationK1Forms: [sCorporationDoc({
                    box17OtherInformation: [{ code: 'V', amount: '80000.00' }],
                })],
            }))
            assert(result.message.includes('box 17 code V'), [result.message])
            assert(result.message.includes('§1.199A-6(b)(3)(iii)'), [result.message])
        },

        /**
         * **THE CONTROL, and the rule rather than a default**: an ABSENT code
         * Z means the entity reported no §199A information, and Reg.
         * §1.199A-6(b)(3)(iii) presumes the owner's share of positive
         * qualified business income to be ZERO. So the return computes and
         * Form 8995 is untouched.
         */
        anAbsentCodeZComputesUnderTheRegulationsPresumption: () => {
            const result = ok(run({ partnershipK1Forms: [partnershipDoc({})] }))
            assertEq(result.parts.line41.value, 8000000n)
        },
    },

    separatelyStatedItems: {
        /**
         * A coded item this engine does not route refuses by name, quoting the
         * box, the CODE and the AMOUNT, and naming §702(a) for a partnership.
         */
        anUnroutedPartnershipCodedItemRefuses: () => {
            const result = refusal(run({
                partnershipK1Forms: [partnershipDoc({
                    box13OtherDeductions: [{ code: 'W', amount: '2500.00' }],
                })],
            }))
            assert(result.message.includes('box 13 code W'), [result.message])
            assert(result.message.includes('2500.00'), ['the refusal must quote the amount', result.message])
            assert(result.message.includes('§702(a)'), [result.message])
            assert(result.message.includes('Northwind Ventures LP'), [result.message])
        },

        /** The S-corporation counterpart names §1366(a)(1) instead. */
        anUnroutedShareholderCodedItemRefusesNamingThirteenSixtySix: () => {
            const result = refusal(run({
                sCorporationK1Forms: [sCorporationDoc({
                    box16ItemsAffectingShareholderBasis: [{ code: 'D', amount: '15000.00' }],
                })],
            }))
            assert(result.message.includes('box 16 code D'), [result.message])
            assert(result.message.includes('§1366(a)(1)'), [result.message])
            assert(!result.message.includes('§702(a)'), ['a shareholder is not a partner', result.message])
        },

        /**
         * A coded row with a ZERO amount is accepted — the same control the
         * dialects' own `unmodeledMoneyBoxes` zero case provides, one layer
         * up. A transcript that prints `0.00` into an unused coded row is
         * ordinary, and refusing it would make the common case unusable.
         */
        aZeroCodedAmountIsAccepted: () => {
            const result = ok(run({
                partnershipK1Forms: [partnershipDoc({
                    box19Distributions: [{ code: 'A', amount: '0.00' }],
                })],
            }))
            assertEq(result.parts.line41.value, 8000000n)
        },

        /**
         * EVERY coded box on each dialect is swept, not only the first — one
         * generated leaf per printed box, so a box quietly dropped from the
         * sweep table is caught rather than silently routing nothing.
         *
         * The amount is a distinct, non-round `$1,234.56` and the assertion is
         * on the BOX NAME in the message, never merely that something was
         * refused.
         */
        ...Object.fromEntries(partnershipCodedBoxes
            .filter(([, printedBox]) => printedBox !== 'box 14' && printedBox !== 'box 20')
            .map(([field, printedBox]) => [
                `partnership${field}IsSwept`,
                () => {
                    const result = refusal(run({
                        partnershipK1Forms: [partnershipDoc({
                            [field]: [{ code: 'Q', amount: '1234.56' }],
                        })],
                    }))
                    assert(
                        result.message.includes(`${printedBox} code Q`),
                        ['the sweep must name this printed box', printedBox, result.message])
                },
            ])),
        ...Object.fromEntries(sCorporationCodedBoxes
            .filter(([, printedBox]) => printedBox !== 'box 17')
            .map(([field, printedBox]) => [
                `sCorporation${field}IsSwept`,
                () => {
                    const result = refusal(run({
                        sCorporationK1Forms: [sCorporationDoc({
                            [field]: [{ code: 'Q', amount: '1234.56' }],
                        })],
                    }))
                    assert(
                        result.message.includes(`${printedBox} code Q`),
                        ['the sweep must name this printed box', printedBox, result.message])
                },
            ])),

        /**
         * The hand-typed counterweight to the generated sweep leaves above: a
         * box dropped from either table would simply generate one fewer leaf
         * and stay green.
         *
         * Both counts are hand-typed off the printed faces — eight coded boxes
         * on the 1065 (11, 13, 14, 15, 17, 18, 19, 20) and six on the 1120-S
         * (10, 12, 13, 15, 16, 17).
         */
        theSweepTablesAreCovered: () => {
            assertEq(partnershipCodedBoxes.length, 8)
            assertEq(sCorporationCodedBoxes.length, 6)
            // The pass-through codes are exactly the four this module argues
            // for: box 14 A (read), B and C (documented), box 20 Z and box 17
            // V (refused one check earlier, with more to say).
            assertEq(
                partnershipCodedBoxes.flatMap(([, , codes]) => codes).join(','),
                'A,B,C,Z',
                'the 1065 pass-through codes, in printed box order')
            assertEq(
                sCorporationCodedBoxes.flatMap(([, , codes]) => codes).join(','),
                'V',
                'the 1120-S has exactly one pass-through code')
        },
    },
}
