/**
 * Form 6781 — *Gains and Losses From Section 1256 Contracts and Straddles*,
 * **Part I only**. TAX-38.
 *
 * Spec:
 * [./todo/section-1256-contracts-marked-to-market.md](./todo/section-1256-contracts-marked-to-market.md),
 * written before this file. Every claim below cites the printed 2025
 * `f6781.pdf` face (whose pages 2-4 ARE its instructions — there is no
 * separate `i6781.pdf`; that URL serves HTML), the 2025 `f1099b--2025.pdf`
 * recipient instructions, Publication 550 (2025) chapter 4, or IRC §1256 read
 * from the U.S. Code.
 *
 * ## What this computes, in one sentence
 *
 * Box 11 of every stored Form 1099-B becomes a Part I line 1 row; lines 2
 * through 7 net them; §1256(a)(3) then splits line 7 into a 40 percent
 * short-term half (line 8) and a 60 percent long-term half (line 9), which
 * `fjs/schedule/d` enters on its own printed lines 4 and 11.
 *
 * ## Box 11 is the input, and the other three boxes are a cross-check
 *
 * Three printed sources agree that line 1 takes box 11 directly:
 *
 * - Form 6781 line 1's own instruction: *"If you received a Form 1099-B ...
 *   include on line 1 the amount from box 11 of each form."*
 * - Form 1099-B (2025) recipient instructions, box 11: *"Boxes 8, 9, and 10
 *   are all used to figure the aggregate profit or (loss) ... Include this
 *   amount on your 2025 Form 6781."*
 * - Pub 550 (2025) p.58: *"This includes the amount shown in box 11 of Form
 *   1099-B."*
 *
 * The aggregate is **box 8 − box 9 + box 10**, and the sign on box 9 is
 * derived rather than remembered: §1256(a)(1) marks every open contract to
 * market at year end and taxes that gain in THAT year, and §1256(a)(2)
 * requires *"proper adjustment ... for gain or loss taken into account by
 * reason of paragraph (1)"*. Box 9 is last year's mark, already taxed, so it
 * comes back out; box 10 is this year's, so it goes in. The 1099-B's own
 * recipient instruction for box 9 uses the word: *"any year-end ADJUSTMENT to
 * the profit or (loss) shown in box 8"*.
 *
 * {@link aggregateDisagreementRefusal} fires when the stored box 11 and the
 * computed aggregate disagree. **Neither side is preferred**, which is the
 * precedent `fjs/document/1095a`'s line 33 cross-check set: a stored annual
 * total that misses the sum of its own twelve rows refuses the document by
 * name rather than one figure quietly winning.
 *
 * ## An absent box among 8, 9 and 10 is a HYPOTHESIS, not a default
 *
 * Box 9 is *last year's* year-end figure, and a first-year §1256 trader
 * legitimately has none — the broker prints nothing. A transcriber who
 * skipped the box also leaves it absent, and inside this year's document the
 * two look identical. The identity settles it: the cross-check reads an
 * absent box among 8, 9, 10 as the hypothesis zero and requires
 * `(box8 ?? 0) − (box9 ?? 0) + (box10 ?? 0) === box11`. A blank consistent
 * with zero computes; a blank the identity says was non-zero refuses.
 *
 * **This is not DOC-11 defaulting.** The hypothesised zero is used only
 * INSIDE a check whose failure is a refusal, and never to compute a printed
 * line: line 1 is box 11 and nothing else. The distinction is the whole
 * reason the rule can be stated at all — a default that fed a line would be
 * invisible, and this one is exactly as visible as the refusal it produces.
 *
 * ## Why box 9 is not this repo's prior-year blocker
 *
 * It is printed on THIS year's 1099-B (`"Unrealized profit or (loss) on open
 * contracts—12/31/2024"`), so reading it is the same act as reading box 8.
 * Nothing here recalls a prior return, and nothing here needs one. Contrast
 * `vnd.fjs.1099g` box 2, which genuinely does: §111's tax-benefit rule needs
 * the prior year's Schedule A, which no document in hand carries.
 *
 * ## The printed order inverts the fractions
 *
 * Line **8** is the **40 percent SHORT**-term half and goes to Schedule D
 * line 4. Line **9** is the **60 percent LONG**-term half and goes to
 * Schedule D line 11. The smaller printed line carries the smaller fraction
 * and the shorter holding period, while the rule is universally spoken of as
 * "60/40" — so both halves read their rate from
 * `fjs/tax/params`'s `sectionTwelveFiftySixCharacterSplit` **by name**
 * (`.shortTerm` / `.longTerm`), never by position, and never as a literal
 * here.
 *
 * The two halves are computed independently from line 7 and always re-sum to
 * it. That is arithmetic, not luck: `0.4x` and `0.6x` in cents have
 * fractional parts drawn from `{0, .2, .4, .6, .8}`, so `halfUp`'s tie rule
 * is unreachable, and the two fractional parts sum to exactly `0` or exactly
 * `1` — when they sum to `1`, exactly one of the two rounds away from zero.
 * {@link proof.theTwoHalvesAlwaysReSumToLineSeven} sweeps it rather than this
 * module asserting it at run time: a theorem about the code is not a guard.
 *
 * ## Parts II and III are NOT here, and Part I alone is a complete deliverable
 *
 * Part II needs, per position, a description, a date entered into, a date
 * closed out, a gross sales price, a cost or other basis plus expense of
 * sale, and the **unrecognized gain on offsetting positions**. Part III needs
 * a description, a date acquired, a fair market value on the last business
 * day of the year, and an adjusted basis. No information return carries any
 * of it — the 1099-B's own box 1c instruction says so outright: *"For
 * aggregate reporting in boxes 8 through 11, no entry will be present."*
 *
 * `fjs/return/scope`'s `straddleGainsAndLosses` is the refusal, and it names
 * the missing columns. For the taxpayer this module serves — an ordinary
 * futures or index-option trader holding no offsetting positions — Form 6781
 * is four printed lines of arithmetic on one number and everything after
 * line 9 is blank. Part I is not a fragment of the form; for that population
 * it IS the form.
 *
 * The residual risk is named rather than hidden: a taxpayer who DOES hold a
 * straddle and does not declare `straddleGainsAndLosses` gets a Part I
 * computed as if line 4 were zero. Nothing in any document proves a straddle,
 * so no tripwire can catch it — `fjs/return/tripwire`'s own rule is that
 * absence is never evidence.
 *
 * ## Lines 4 and 6 are documented zeros, each with a kind that refuses it
 *
 * Line 4 ("Form 1099-B adjustments") carries only straddle and hedging
 * items — the line 4 instruction lists four, and every one begins "the
 * section 1256 contract part of a mixed straddle", "the amount of the loss,
 * if you didn't make any of the mixed straddle elections", or "the section
 * 1256 contract part of a hedging transaction". `straddleGainsAndLosses`
 * refuses all of them.
 *
 * Line 6 is the box D net section 1256 contracts loss carried back. The
 * printed instruction for a filer who did not check box D is "enter -0-",
 * which is what this computes; `netSectionTwelveFiftySixContractsLossCarryback`
 * refuses the election itself, because §1212(c) carries the loss back THREE
 * years and needs an amended Form 6781 and Schedule D for each.
 *
 * ## This module does not read documents, and does not know what a CAS is
 *
 * It receives an already-selected, already-validated list of stored 1099-B
 * values, exactly as `fjs/form8949` and `fjs/schedule/d` do, and returns a
 * value. Its refusals are RETURNED, never thrown.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { of, halfUp } from '../types/rational/module.f.js'
import { taxParamsByYear } from '../tax/params/module.f.js'

/** @import { OneZeroNineNineB } from '../document/1099b/module.f.js' */
/** @import { Source } from '../report/line/module.f.js' */
/** @import { TaxParamSet } from '../tax/params/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A document as stored: its CAS hash beside its already-validated value — the
 * same local `Stored<T>` every form and schedule module in this repo declares
 * for itself. Nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything Part I needs: the Forms 1099-B supplied for the return.
 *
 * One field, and it stays an object rather than becoming a bare parameter so
 * that a later slice adding Part II's own inputs does not have to move every
 * call site — the shape `Form8949Inputs` and `ScheduleDInputs` already use.
 * @typedef {{ readonly brokerageForms: readonly Stored<OneZeroNineNineB>[] }} Form6781Inputs
 */

// ── Outputs ──────────────────────────────────────────────────────────────────

/**
 * One Part I line 1 row: the account it came from and its box 11 amount, kept
 * per document rather than only as a total.
 *
 * Column (a) on the printed face is *"Identification of account"*, and the
 * line 1 instruction says to enter *"'Form 1099-B' and the broker's name"*.
 * This engine holds the CAS hash, which identifies the document exactly and
 * carries no taxpayer name — so `identification` is that hash, and the
 * printed broker name is a rendering concern rather than a computed one.
 * @typedef {{
 *   readonly identification: string,
 *   readonly aggregateCents: bigint,
 * }} Form6781LineOneRow
 */

/**
 * Part I, computed. Every field is one printed line, in printed order.
 *
 * `line2LossColumnCents` is a **negative** bigint (or zero). The printed face
 * prints column (b) inside parentheses — `2 (        )` — which is the paper's
 * way of writing a negative, and storing the magnitude instead would put a
 * sign convention between this module and its reader that nothing enforces.
 *
 * The two columns of line 2 are kept separately rather than netted for the
 * reason `fjs/schedule/d` keeps its lines 7 and 15 independently observable:
 * a sign error inside one document vanishes in a single net and survives in
 * the pair.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1Rows: readonly Form6781LineOneRow[],
 *   readonly line2LossColumnCents: bigint,
 *   readonly line2GainColumnCents: bigint,
 *   readonly line3NetGainOrLossCents: bigint,
 *   readonly line4Form1099BAdjustmentsCents: bigint,
 *   readonly line5Cents: bigint,
 *   readonly line6LossCarriedBackCents: bigint,
 *   readonly line7Cents: bigint,
 *   readonly line8ShortTermCents: bigint,
 *   readonly line9LongTermCents: bigint,
 *   readonly sources: readonly Source[],
 * }} Form6781Ok
 */

/**
 * A case this form will not compute — the same shape `fjs/form8949`,
 * `fjs/schedule/d` and `fjs/form8962` already return, so a caller threads it
 * through the error arm it already has.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form6781Refusal
 */

/** @typedef {Form6781Ok | Form6781Refusal} Form6781Outcome */

// ── Refusals ─────────────────────────────────────────────────────────────────

/**
 * Where Part I's two answers end up, quoted in every refusal so the message
 * says what was lost as well as why. AGENTS.md records an entire verification
 * sweep in which five refusal proofs asserted the box name and the phrase
 * "cannot compute" and not one asserted where the amount would have gone.
 * @type {string}
 */
const destination = 'Form 6781 line 8 (40% short-term) -> Schedule D line 4 and line 9 '
    + '(60% long-term) -> Schedule D line 11, and thence 1040 line 7a'

/**
 * The three component boxes, named once so the refusal messages, the
 * cross-check and this module's proofs all walk the identical list rather
 * than three hand-written copies that could drift (AGENTS.md, "one rule, one
 * place").
 *
 * The order is the printed order, and the SIGN each carries in the identity
 * travels with the name — because the sign on box 9 is the one thing about
 * this form a reader is likely to get wrong from memory.
 *
 * Typed via `@type {const}` (not a wider `keyof OneZeroNineNineB`) so
 * `box[field]` resolves to exactly `string | undefined` — the same reason
 * `fjs/document/1099b`'s own `moneyBoxFields` is written this way.
 */
const aggregateComponents = /** @type {const} */ ([
    ['box8ProfitOrLossRealized', 1n, 'profit or (loss) realized on closed contracts'],
    ['box9UnrealizedProfitOrLossPriorYearEnd', -1n, 'unrealized profit or (loss) on contracts '
        + 'open at the PRIOR year end, backed out under §1256(a)(2) because §1256(a)(1) already '
        + 'taxed it last year'],
    ['box10UnrealizedProfitOrLossCurrentYearEnd', 1n, 'unrealized profit or (loss) on contracts '
        + 'open at THIS year end, marked to market under §1256(a)(1)'],
])

/**
 * Independently hand-typed: three component boxes. Deliberately NOT
 * `aggregateComponents.length` — every loop below iterates that table, which
 * is the code under test, so a row deleted would vanish from the loop in the
 * same instant (AGENTS.md's fourth shipped defect).
 * @type {number}
 */
const expectedAggregateComponentCount = 3

/**
 * **R1.** A 1099-B reports §1256 activity in boxes 8, 9 or 10 but prints no
 * box 11.
 *
 * Box 11 is what all three printed sources send to line 1, and this engine
 * will not reconstruct it from an incomplete set: a broker that reported the
 * components without their aggregate, or a transcription that lost it, is a
 * document this engine reads as incomplete rather than as a zero.
 * @type {(documentHash: string) => (presentBoxes: readonly string[]) => Form6781Refusal}
 */
export const missingAggregateRefusal = documentHash => presentBoxes => ({
    kind: 'error',
    message: `Form 6781 line 1: brokerage document ${documentHash} carries `
        + `${presentBoxes.join(', ')} but no box11AggregateProfitOrLoss. Form 6781's line 1 `
        + `instruction is to "include on line 1 the amount from box 11 of each form", and Form `
        + `1099-B's own box 11 instruction is "Include this amount on your 2025 Form 6781" — so `
        + `box 11 is the figure this form takes, and a document reporting section 1256 activity `
        + `without printing its aggregate is incomplete. Refusing rather than reconstructing the `
        + `aggregate from the components, which would silently promote this engine's arithmetic `
        + `over the broker's own reported figure, and rather than reading the absent box as zero, `
        + `which would drop the whole position. Re-transcribe box 11 from the printed form. `
        + `Nothing reaches ${destination}`,
})

/**
 * **R2.** The stored box 11 and the aggregate its own components imply
 * disagree.
 *
 * **Neither side is preferred.** The message carries BOTH figures and names
 * which of boxes 8, 9 and 10 were blank, because a blank is the likeliest
 * explanation and it is the part of the message a reader can act on: a
 * first-year trader's genuinely-empty box 9 passes this check (0 is what the
 * identity implies), so a blank named here is one the identity says was NOT
 * zero.
 * @type {(documentHash: string) => (storedCents: bigint) => (computedCents: bigint) => (absentBoxes: readonly string[]) => Form6781Refusal}
 */
export const aggregateDisagreementRefusal
    = documentHash => storedCents => computedCents => absentBoxes => ({
        kind: 'error',
        message: `Form 6781 line 1: brokerage document ${documentHash} stores `
            + `box11AggregateProfitOrLoss as ${centsToString(storedCents)}, but boxes 8, 9 and 10 `
            + `imply ${centsToString(computedCents)}. The aggregate is box 8 minus box 9 plus box `
            + `10 — box 9 is last year's mark to market, which §1256(a)(1) already taxed last `
            + `year and §1256(a)(2) requires be backed out, and box 10 is this year's. `
            + (absentBoxes.length === 0
                ? 'All three components are present, so one of the four printed figures is wrong '
                + 'and nothing in the document says which. '
                : `${absentBoxes.join(' and ')} ${absentBoxes.length === 1 ? 'is' : 'are'} `
                + `ABSENT, and the identity says the blank was not zero — a first-year trader's `
                + `genuinely empty box 9 satisfies this check, so a blank named here is a `
                + `transcription that lost a figure, not a broker that had none to print. `)
            + `Refusing rather than preferring either side. Nothing reaches ${destination}`,
    })

// ── Form 6781, Part I ────────────────────────────────────────────────────────

/**
 * One box's cents, or `undefined` when the box is absent. Absent is ABSENT
 * (DOC-11) — this returns `undefined` rather than `0n` so that every caller
 * has to say, at its own site, what it does about the absence.
 * @type {(printed: string | undefined) => bigint | undefined}
 */
const boxCents = printed => printed === undefined ? undefined : centsFromString(printed)

/**
 * Rounds a percentage of a cents amount, half away from zero, exactly once —
 * at the printed line, never per document.
 *
 * `ratePercent` arrives from `fjs/tax/params` as a whole number, so this is
 * `cents * rate / 100` as an exact rational with one `halfUp` at the end; no
 * intermediate value is ever a `number`.
 * @type {(cents: bigint) => (ratePercent: number) => bigint}
 */
const percentOf = cents => ratePercent => halfUp(of(cents * BigInt(ratePercent))(100n))

/**
 * Computes Form 6781 Part I for one return from the stored Forms 1099-B.
 * Every `const` below is one printed line, in printed order.
 * @type {(taxParamSet: TaxParamSet) => (inputs: Form6781Inputs) => Form6781Outcome}
 */
export const form6781 = taxParamSet => inputs => {
    /** @type {Form6781LineOneRow[]} */
    const line1Rows = []
    /** @type {Source[]} */
    const sources = []
    for (const document of inputs.brokerageForms) {
        const box = document.value
        // The three components, read through the shared table so the identity
        // below and the two refusal messages cannot name different boxes.
        const components = aggregateComponents.map(
            ([field, sign, caption]) => ({ field, sign, caption, cents: boxCents(box[field]) }))
        const presentBoxes = components.filter(c => c.cents !== undefined).map(c => c.field)
        const absentBoxes = components.filter(c => c.cents === undefined).map(c => c.field)
        const stored = boxCents(box.box11AggregateProfitOrLoss)
        if (stored === undefined) {
            // R1 — components without their aggregate. A document with NONE of
            // the four is not a section 1256 document at all and simply
            // contributes nothing; this fires only when at least one component
            // is printed.
            if (presentBoxes.length === 0) {
                continue
            }
            return missingAggregateRefusal(document.documentHash)(presentBoxes)
        }
        // R2 — the cross-check. An absent component is the HYPOTHESIS zero
        // here and NOWHERE else: `stored` is what reaches line 1, always.
        const computed = components.reduce(
            (total, component) => total + component.sign * (component.cents ?? 0n), 0n)
        if (computed !== stored) {
            return aggregateDisagreementRefusal(
                document.documentHash)(stored)(computed)(absentBoxes)
        }
        // **`stored`, and the guard above makes that an EQUIVALENT MUTANT** —
        // recorded here because it is a property of this code nobody had
        // written down until a mutation went looking. Replacing `stored` with
        // `computed` on this line changes the source and cannot turn red at
        // any input, because the two are equal by the three lines above it.
        // Measured: the whole suite stayed green at 2,938 leaves.
        //
        // That does NOT make the choice arbitrary, and the mutation that
        // bites says why: weaken the guard AND take `computed`, and four
        // leaves redden. What the pair encodes is that this engine takes the
        // BROKER'S reported aggregate and refuses when its own arithmetic
        // disagrees — it never reconstructs the figure and quietly files it,
        // which is exactly what {@link missingAggregateRefusal}'s message
        // promises a reader. `stored` is the honest token even where it is
        // an unobservable one, and a later edit that removes the guard must
        // not find `computed` already sitting here.
        line1Rows.push({ identification: document.documentHash, aggregateCents: stored })
        // The citation is box 11 — the box the printed line actually takes.
        // The three components are cited nowhere, because nothing they touch
        // reaches a line; their only reader is the refusal above.
        sources.push({
            documentHash: document.documentHash,
            boxPath: 'box11AggregateProfitOrLoss',
            value: box.box11AggregateProfitOrLoss ?? '',
        })
    }

    // 2. "Add the amounts on line 1 in columns (b) and (c)." Column (b) is
    //    printed in parentheses on the face — a negative — and is kept
    //    separate from column (c) so a sign error in one document survives
    //    into an observable field instead of cancelling inside a net.
    const line2LossColumnCents = line1Rows.reduce(
        (total, row) => row.aggregateCents < 0n ? total + row.aggregateCents : total, 0n)
    const line2GainColumnCents = line1Rows.reduce(
        (total, row) => row.aggregateCents > 0n ? total + row.aggregateCents : total, 0n)
    // 3. "Net gain or (loss). Combine line 2, columns (b) and (c)."
    const line3NetGainOrLossCents = line2GainColumnCents + line2LossColumnCents
    // 4. "Form 1099-B adjustments. See instructions and attach statement."
    //    Documented 0: every adjustment the line 4 instruction lists is a
    //    straddle or hedging item, and `straddleGainsAndLosses` is the kind
    //    that refuses those.
    const line4Form1099BAdjustmentsCents = 0n
    // 5. "Combine lines 3 and 4."
    const line5Cents = line3NetGainOrLossCents + line4Form1099BAdjustmentsCents
    // 6. The box D net section 1256 contracts loss carried back. Documented 0:
    //    the printed instruction for a filer who did not check box D is "enter
    //    -0-", and `netSectionTwelveFiftySixContractsLossCarryback` is the kind
    //    that refuses the election. Note the printed note above line 6 — "If
    //    line 5 shows a net gain, skip line 6 and enter the gain on line 7" —
    //    is satisfied by the same zero, so no branch on line 5's sign is
    //    needed and none is written.
    const line6LossCarriedBackCents = 0n
    // 7. "Combine lines 5 and 6."
    const line7Cents = line5Cents + line6LossCarriedBackCents
    // 8. "Short-term capital gain or (loss). Multiply line 7 by 40% (0.40).
    //    Enter here and include on line 4 of Schedule D."
    // 9. "Long-term capital gain or (loss). Multiply line 7 by 60% (0.60).
    //    Enter here and include on line 11 of Schedule D."
    //
    // Read by NAME off the parameter set, never by position: the printed order
    // puts the smaller fraction on the smaller line number, which is exactly
    // the transposition a positional read would make invisible.
    const split = taxParamSet.sectionTwelveFiftySixCharacterSplit
    const line8ShortTermCents = percentOf(line7Cents)(split.shortTerm.ratePercent)
    const line9LongTermCents = percentOf(line7Cents)(split.longTerm.ratePercent)

    return {
        kind: 'ok',
        line1Rows,
        line2LossColumnCents,
        line2GainColumnCents,
        line3NetGainOrLossCents,
        line4Form1099BAdjustmentsCents,
        line5Cents,
        line6LossCarriedBackCents,
        line7Cents,
        line8ShortTermCents,
        line9LongTermCents,
        sources,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/**
 * A 1099-B carrying only the fields its schema requires, plus whatever §1256
 * boxes a case names. `sourceArtifactHash` is a real cBase32 hash because the
 * dialect's `checkReferences` insists — these fixtures are not validated here,
 * but a fixture that could not survive validation is a fixture that proves
 * nothing about a stored document.
 * @type {(documentHash: string) => (boxes: Partial<OneZeroNineNineB>) => Stored<OneZeroNineNineB>}
 */
const brokerageDocument = documentHash => boxes => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.1099b',
        payerTin: '55-5555555',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-6781',
        taxYear: 2025,
        formRevision: '2025',
        sourceArtifactHash: 'bhtsw5fzcphk3hqrsyzk5wzp2ktnkkfnc8p8w6ynqxwlfa2vcrfg',
        ...boxes,
    },
})

/**
 * A §1256 document whose four boxes satisfy the identity by construction of
 * the CASE, not of the helper: boxes 8, 9 and 10 are given and box 11 is
 * given too. The helper deliberately does NOT compute box 11 from the other
 * three — that would make every fixture satisfy the cross-check the fixtures
 * exist to exercise, which is AGENTS.md's fourth shipped defect wearing a
 * fixture's clothes.
 * @type {(documentHash: string) => (box8: string) => (box9: string) => (box10: string) => (box11: string) => Stored<OneZeroNineNineB>}
 */
const sectionTwelveFiftySixDocument = documentHash => box8 => box9 => box10 => box11 =>
    brokerageDocument(documentHash)({
        box8ProfitOrLossRealized: box8,
        box9UnrealizedProfitOrLossPriorYearEnd: box9,
        box10UnrealizedProfitOrLossCurrentYearEnd: box10,
        box11AggregateProfitOrLoss: box11,
    })

/** @type {(outcome: Form6781Outcome) => Form6781Ok} */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 6781 Part I to compute', outcome])
    return outcome
}

/** @type {(outcome: Form6781Outcome) => string} */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 6781 to refuse', outcome])
    return outcome.message
}

/**
 * Every refusal must say WHERE the amount would have gone — both Schedule D
 * lines and the 1040 line they feed. AGENTS.md records a whole sweep in which
 * erasing `${destination}` survived the entire suite.
 * @type {(message: string) => void}
 */
const assertNamesTheDestination = message => {
    assert(
        message.includes('Schedule D line 4') && message.includes('Schedule D line 11'),
        ['a refusal must name both Schedule D lines the amount would have reached', message])
    assert(
        message.includes('1040 line 7a'),
        ['and the 1040 line those two feed', message])
}

/** @type {(documents: readonly Stored<OneZeroNineNineB>[]) => Form6781Outcome} */
const run = documents => form6781(taxParams2025)({ brokerageForms: documents })

export const proof = {
    // The component table's own shape. Three rows, three DISTINCT box names,
    // and the SIGNS spelled out one at a time — because `[1, -1, 1]` asserted
    // as a whole would let a swap of the first and third rows pass, and those
    // two rows are the two that share a sign.
    theIdentityIsBoxEightMinusBoxNinePlusBoxTen: () => {
        assertEq(aggregateComponents.length, expectedAggregateComponentCount)
        assertEq(new Set(aggregateComponents.map(([field]) => field)).size,
            expectedAggregateComponentCount)
        const [eight, nine, ten] = aggregateComponents
        assert(eight !== undefined && nine !== undefined && ten !== undefined,
            ['the component table lost a row', aggregateComponents])
        if (eight === undefined || nine === undefined || ten === undefined) {
            throw ['the component table lost a row', aggregateComponents]
        }
        assertEq(eight[0], 'box8ProfitOrLossRealized')
        assertEq(eight[1], 1n, 'box 8 is realized profit this year: it goes IN')
        assertEq(nine[0], 'box9UnrealizedProfitOrLossPriorYearEnd')
        assertEq(nine[1], -1n,
            'box 9 is LAST year\'s mark, already taxed under §1256(a)(1): §1256(a)(2) backs it OUT')
        assertEq(ten[0], 'box10UnrealizedProfitOrLossCurrentYearEnd')
        assertEq(ten[1], 1n, 'box 10 is THIS year\'s mark: it goes IN')
        for (const [field, , caption] of aggregateComponents) {
            assert(caption.length >= 10, ['a component carries no usable caption', field, caption])
        }
    },
    /*
     * ★ THE WORKED GAIN, hand-typed in cents from the printed face.
     *
     * One 1099-B, second year of trading:
     *   box 8   profit realized on closed contracts        $ 40,000.00
     *   box 9   unrealized, open at 12/31/2024             $  6,000.00
     *   box 10  unrealized, open at 12/31/2025             $  9,000.00
     *   box 11  aggregate = 40,000 - 6,000 + 9,000         $ 43,000.00
     *
     *   line 1(c)  gain column                              4300000
     *   line 1(b)  loss column                                    0
     *   line 3     43,000.00 - 0                            4300000
     *   line 4     documented 0                                   0
     *   line 5     43,000.00                                4300000
     *   line 6     documented 0                                   0
     *   line 7     43,000.00                                4300000
     *   line 8     40% of 43,000.00 = 17,200.00             1720000  -> Sch D line 4
     *   line 9     60% of 43,000.00 = 25,800.00             2580000  -> Sch D line 11
     *
     * 17,200.00 + 25,800.00 = 43,000.00, and the LONG half is the larger.
     */
    aWorkedGainSplitsSixtyFortyWithTheLongHalfLarger: () => {
        const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-gain')(
            '40000.00')('6000.00')('9000.00')('43000.00')]))
        assertEq(result.line1Rows.length, 1)
        assertEq(result.line2GainColumnCents, 4300000n, '$43,000.00 in column (c)')
        assertEq(result.line2LossColumnCents, 0n, 'nothing in column (b)')
        assertEq(result.line3NetGainOrLossCents, 4300000n)
        assertEq(result.line4Form1099BAdjustmentsCents, 0n, 'documented zero')
        assertEq(result.line5Cents, 4300000n)
        assertEq(result.line6LossCarriedBackCents, 0n, 'documented zero')
        assertEq(result.line7Cents, 4300000n)
        assertEq(result.line8ShortTermCents, 1720000n, '$17,200.00 — 40%, SHORT term, Sch D line 4')
        assertEq(result.line9LongTermCents, 2580000n, '$25,800.00 — 60%, LONG term, Sch D line 11')
        assert(
            result.line9LongTermCents > result.line8ShortTermCents,
            ['the 60% long half must be the larger one on a GAIN', result])
    },
    /*
     * ★ THE SIGN TRAP. The same arithmetic on a LOSS, so a sign flip or an
     * absolute value anywhere in the split cannot hide behind a gain.
     *
     *   box 8   loss realized on closed contracts          $-30,000.00
     *   box 9   unrealized, open at 12/31/2024             $  5,000.00
     *   box 10  unrealized, open at 12/31/2025             $ -2,000.00
     *   box 11  aggregate = -30,000 - 5,000 + (-2,000)     $-37,000.00
     *
     *   line 1(b)  loss column                            -3700000
     *   line 1(c)  gain column                                   0
     *   line 7                                            -3700000
     *   line 8     40% of -37,000.00 = -14,800.00         -1480000
     *   line 9     60% of -37,000.00 = -22,200.00         -2220000
     *
     * Both halves are NEGATIVE, and the long half is the more negative — the
     * inequality flips with the sign, which is why the gain case above
     * asserts `>` and this one asserts `<`.
     */
    aWorkedLossKeepsItsSignInBothHalves: () => {
        const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-loss')(
            '-30000.00')('5000.00')('-2000.00')('-37000.00')]))
        assertEq(result.line2LossColumnCents, -3700000n, '$-37,000.00 in column (b)')
        assertEq(result.line2GainColumnCents, 0n, 'nothing in column (c)')
        assertEq(result.line7Cents, -3700000n)
        assertEq(result.line8ShortTermCents, -1480000n, '$-14,800.00 — 40% of a loss is a loss')
        assertEq(result.line9LongTermCents, -2220000n, '$-22,200.00 — 60% of a loss is a loss')
        assert(
            result.line9LongTermCents < result.line8ShortTermCents,
            ['on a LOSS the 60% long half is the MORE negative one', result])
    },
    /*
     * ★ THE ROUNDING CASE, built so the two halves round in OPPOSITE
     * directions. Line 7 = $1,234.57 = 123457 cents.
     *
     *   40%: 123457 * 40 / 100 = 49382.8   -> halfUp -> 49383   (rounds UP)
     *   60%: 123457 * 60 / 100 = 74074.2   -> halfUp -> 74074   (rounds DOWN)
     *   49383 + 74074 = 123457                                   exactly line 7
     *
     * A truncation instead of a rounding would give 49382 + 74074 = 123456 and
     * lose a cent; the sum assertion is what catches that, and the two
     * separate assertions are what say which half moved.
     */
    theTwoHalvesRoundInOppositeDirectionsAndStillSumToLineSeven: () => {
        const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-odd')(
            '1234.57')('0.00')('0.00')('1234.57')]))
        assertEq(result.line7Cents, 123457n, '$1,234.57')
        assertEq(result.line8ShortTermCents, 49383n, '$493.83 — 49382.8 rounds UP')
        assertEq(result.line9LongTermCents, 74074n, '$740.74 — 74074.2 rounds DOWN')
        assertEq(
            result.line8ShortTermCents + result.line9LongTermCents, 123457n,
            'and they still exhaust line 7 to the cent')
    },
    /*
     * The same rounding case with the sign reversed, because `halfUp` breaks
     * ties away from zero at BOTH signs and a rounding written with
     * JavaScript's `Math.round` (biased toward +Infinity) would diverge here
     * and nowhere in the positive cases.
     *
     *   40% of -123457: -49382.8 -> -49383   (magnitude UP)
     *   60% of -123457: -74074.2 -> -74074   (magnitude DOWN)
     */
    theOppositeRoundingHoldsAtNegativeLineSeven: () => {
        const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-oddneg')(
            '-1234.57')('0.00')('0.00')('-1234.57')]))
        assertEq(result.line7Cents, -123457n)
        assertEq(result.line8ShortTermCents, -49383n)
        assertEq(result.line9LongTermCents, -74074n)
        assertEq(result.line8ShortTermCents + result.line9LongTermCents, -123457n)
    },
    /**
     * The theorem the module docstring states, swept rather than asserted at
     * run time: `line8 + line9 === line7` at every line 7 in a range that
     * covers every residue of 5 at both signs, plus four magnitudes far above
     * anything the small cases reach.
     *
     * The expected side is `line7` itself, which is NOT the code under test —
     * line 7 is a plain sum of inputs and the split is what this sweeps.
     */
    theTwoHalvesAlwaysReSumToLineSeven: () => {
        let swept = 0
        for (let cents = -137n; cents <= 137n; cents += 1n) {
            const short = percentOf(cents)(40)
            const long = percentOf(cents)(60)
            assertEq(short + long, cents, ['the split must exhaust line 7', cents, short, long])
            swept += 1
        }
        for (const cents of [-999999999n, -1000000n, 1000000n, 999999999n]) {
            const short = percentOf(cents)(40)
            const long = percentOf(cents)(60)
            assertEq(short + long, cents, ['the split must exhaust line 7', cents, short, long])
            swept += 1
        }
        assertEq(swept, 279, 'hand-counted: 275 contiguous cents plus 4 large magnitudes')
    },
    /**
     * The 40/60 fractions come from `fjs/tax/params` by NAME, and this leaf is
     * what proves it: it recomputes both halves from the parameter set's own
     * fields and requires them to match what `form6781` returned. A literal
     * `40` or `60` written into this module would still pass every worked case
     * above and fails here the moment the parameter moves.
     */
    bothHalvesReadTheirRateFromTheParameterSet: () => {
        const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-param')(
            '9999.99')('0.00')('0.00')('9999.99')]))
        const split = taxParams2025.sectionTwelveFiftySixCharacterSplit
        assertEq(
            result.line8ShortTermCents, percentOf(result.line7Cents)(split.shortTerm.ratePercent),
            'line 8 is the SHORT-term rate applied to line 7')
        assertEq(
            result.line9LongTermCents, percentOf(result.line7Cents)(split.longTerm.ratePercent),
            'line 9 is the LONG-term rate applied to line 7')
        // And the two are genuinely different, so the leaf above could not
        // pass by both reading the same field.
        assert(
            result.line8ShortTermCents !== result.line9LongTermCents,
            ['a non-zero line 7 must split into two different halves', result])
    },
    /**
     * Several forms combine on line 2, and the two columns stay separate. Two
     * gains and one loss: the columns are $9,000.00 and $-4,000.00, and line 3
     * is $5,000.00. Netting them into one field would make this leaf and the
     * single-document leaves indistinguishable.
     */
    manyFormsCombineWithTheTwoColumnsKeptApart: () => {
        const result = expectOk(run([
            sectionTwelveFiftySixDocument('sha256-a')('5000.00')('0.00')('1000.00')('6000.00'),
            sectionTwelveFiftySixDocument('sha256-b')('-4000.00')('0.00')('0.00')('-4000.00'),
            sectionTwelveFiftySixDocument('sha256-c')('3000.00')('1000.00')('1000.00')('3000.00'),
        ]))
        assertEq(result.line1Rows.length, 3)
        assertEq(result.line2GainColumnCents, 900000n, '$6,000.00 + $3,000.00')
        assertEq(result.line2LossColumnCents, -400000n, '$-4,000.00, alone in column (b)')
        assertEq(result.line3NetGainOrLossCents, 500000n, '$5,000.00 net')
        assertEq(result.line8ShortTermCents, 200000n, '$2,000.00')
        assertEq(result.line9LongTermCents, 300000n, '$3,000.00')
        // The citations name box 11 on each of the three, and NOT the three
        // component boxes — which reach no line and are cited nowhere.
        assertEq(result.sources.length, 3)
        for (const source of result.sources) {
            assertEq(source.boxPath, 'box11AggregateProfitOrLoss')
        }
        assertEq(
            result.sources.map(s => s.documentHash).join(' '),
            'sha256-a sha256-b sha256-c',
            'one citation per contributing document, in the order supplied')
    },
    /**
     * THE CONTROL for every case above: a return with no 1099-B at all, and a
     * return whose only 1099-B is an ordinary stock sale with none of the four
     * §1256 boxes, both compute a Part I of zeros rather than refusing.
     *
     * The second half is what stops R1 from firing on the overwhelmingly
     * common document — an ordinary brokerage 1099-B — which is the way a
     * refusal like R1 goes wrong.
     */
    aReturnWithNoSectionTwelveFiftySixActivityIsAllZeros: () => {
        for (const documents of [
            [],
            [brokerageDocument('sha256-stock')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '7000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })],
        ]) {
            const result = expectOk(run(documents))
            assertEq(result.line1Rows.length, 0)
            assertEq(result.line7Cents, 0n)
            assertEq(result.line8ShortTermCents, 0n)
            assertEq(result.line9LongTermCents, 0n)
            assertEq(result.sources.length, 0)
        }
    },
    refusals: {
        /**
         * ★ **R2, THE CROSS-CHECK.** A second-year document whose box 9 was
         * lost in transcription: boxes 8 and 10 are present, box 9 is blank,
         * and the identity says the blank was $2,000.00 rather than nothing.
         *
         *   stored box 11   $ 2,000.00
         *   8 - 9 + 10      3,000 - 0 + 1,000 = $ 4,000.00
         */
        aStoredAggregateThatMissesItsComponentsIsRefused: () => {
            const message = expectRefusal(run([brokerageDocument('sha256-drift')({
                box8ProfitOrLossRealized: '3000.00',
                box10UnrealizedProfitOrLossCurrentYearEnd: '1000.00',
                box11AggregateProfitOrLoss: '2000.00',
            })]))
            assert(message.includes('sha256-drift'), ['the document at issue', message])
            assert(message.includes('2000.00'), ['the STORED figure', message])
            assert(message.includes('4000.00'), ['the COMPUTED figure', message])
            assert(
                message.includes('box9UnrealizedProfitOrLossPriorYearEnd'),
                ['and WHICH box was blank — the part a reader can act on', message])
            assert(
                message.includes('§1256(a)(2)'),
                ['the statute that puts the minus sign on box 9', message])
            assertNamesTheDestination(message)
        },
        /**
         * ★ **THE CONTROL R2 EXISTS FOR, and the answer to "is an absent box 9
         * a missing box or a first year of trading?"** The IDENTICAL document
         * shape — box 9 absent, boxes 8, 10 and 11 present — computes when the
         * identity says the blank was zero.
         *
         * A first-year trader: $3,000.00 realized, $2,000.00 still open at
         * 12/31/2025, nothing open at 12/31/2024, aggregate $5,000.00.
         */
        aFirstYearTradersGenuinelyEmptyBoxNineComputes: () => {
            const result = expectOk(run([brokerageDocument('sha256-firstyear')({
                box8ProfitOrLossRealized: '3000.00',
                box10UnrealizedProfitOrLossCurrentYearEnd: '2000.00',
                box11AggregateProfitOrLoss: '5000.00',
            })]))
            assertEq(result.line7Cents, 500000n, '$5,000.00 — box 11, unchanged')
            assertEq(result.line8ShortTermCents, 200000n, '$2,000.00')
            assertEq(result.line9LongTermCents, 300000n, '$3,000.00')
        },
        /**
         * R2 again, with ALL THREE components present, so the message takes
         * its other arm: nothing is blank and one of the four printed figures
         * is simply wrong. One cent of drift is enough.
         */
        oneCentOfDriftWithEveryComponentPresentIsRefused: () => {
            const message = expectRefusal(run([sectionTwelveFiftySixDocument('sha256-cent')(
                '40000.00')('6000.00')('9000.00')('43000.01')]))
            assert(message.includes('43000.01'), ['the stored figure', message])
            assert(message.includes('43000.00'), ['the computed figure', message])
            assert(
                message.includes('All three components are present'),
                ['with no blank to blame, the message must say so', message])
            assertNamesTheDestination(message)
        },
        /**
         * THE CONTROL for the leaf above, one cent the other way: the same
         * four figures with box 11 exactly right compute.
         */
        theSameDocumentOneCentTheOtherWayComputes: () => {
            const result = expectOk(run([sectionTwelveFiftySixDocument('sha256-cent-ok')(
                '40000.00')('6000.00')('9000.00')('43000.00')]))
            assertEq(result.line7Cents, 4300000n)
        },
        /**
         * ★ **R1.** A document reporting §1256 activity with no box 11 at all
         * is refused, naming the components it DID print.
         */
        componentsWithoutTheirAggregateAreRefused: () => {
            const message = expectRefusal(run([brokerageDocument('sha256-noagg')({
                box8ProfitOrLossRealized: '7500.00',
                box9UnrealizedProfitOrLossPriorYearEnd: '100.00',
            })]))
            assert(message.includes('sha256-noagg'), ['the document', message])
            assert(
                message.includes('box8ProfitOrLossRealized')
                && message.includes('box9UnrealizedProfitOrLossPriorYearEnd'),
                ['the components it DID print, both of them', message])
            assert(
                !message.includes('box10UnrealizedProfitOrLossCurrentYearEnd'),
                ['and not the one it did not', message])
            assert(
                message.includes('box11AggregateProfitOrLoss'),
                ['the box that is missing', message])
            assertNamesTheDestination(message)
        },
        /**
         * THE CONTROL for R1: a document with NONE of the four boxes is not a
         * §1256 document and contributes nothing — it is not refused. This is
         * the same assertion `aReturnWithNoSectionTwelveFiftySixActivityIsAllZeros`
         * makes from the other side, and it is repeated here because R1's
         * guard is `presentBoxes.length === 0` and a mutation to that line
         * should redden a leaf sitting next to the refusal it bounds.
         */
        aDocumentWithNoneOfTheFourBoxesIsNotRefused: () => {
            const result = expectOk(run([brokerageDocument('sha256-plain')({})]))
            assertEq(result.line1Rows.length, 0)
            assertEq(result.line7Cents, 0n)
        },
        /**
         * A refusal on the SECOND document still refuses the whole form, and
         * the first document's perfectly good figures do not leak out as a
         * partial answer. The message names the second document, not the
         * first.
         */
        aRefusalOnOneFormRefusesTheWholeThing: () => {
            const message = expectRefusal(run([
                sectionTwelveFiftySixDocument('sha256-good')(
                    '1000.00')('0.00')('0.00')('1000.00'),
                sectionTwelveFiftySixDocument('sha256-bad')(
                    '1000.00')('0.00')('0.00')('9999.00'),
            ]))
            assert(message.includes('sha256-bad'), ['the offending document', message])
            assert(!message.includes('sha256-good'), ['and not the innocent one', message])
        },
    },
    /**
     * ★ **Q6: wiring boxes 8-11 does not disturb the box 1 path.** A
     * CONSOLIDATED 1099-B carrying an ordinary stock sale AND the four §1256
     * boxes computes a Part I from box 11 alone. Box 1d and box 1e are read by
     * nothing here — the printed form guarantees they are disjoint amounts
     * ("This box does not include proceeds from regulated futures contracts or
     * Section 1256 option contracts") — so the §1256 answer is identical to
     * the one the same document without the stock sale would give.
     *
     * The comparison against the stripped document is the load-bearing half:
     * an implementation that accidentally folded box 1d's proceeds into line 1
     * would pass a bare `assertEq(line7Cents, …)` written from the same file.
     */
    aConsolidatedFormsStockSaleDoesNotReachPartOne: () => {
        const withStock = expectOk(run([brokerageDocument('sha256-both')({
            box1dProceeds: '10000.00',
            box1eCostOrOtherBasis: '7000.00',
            box2LongTermGainOrLoss: true,
            box12BasisReportedToIrs: true,
            box8ProfitOrLossRealized: '2000.00',
            box9UnrealizedProfitOrLossPriorYearEnd: '500.00',
            box10UnrealizedProfitOrLossCurrentYearEnd: '500.00',
            box11AggregateProfitOrLoss: '2000.00',
        })]))
        const withoutStock = expectOk(run([sectionTwelveFiftySixDocument('sha256-both')(
            '2000.00')('500.00')('500.00')('2000.00')]))
        assertEq(withStock.line7Cents, withoutStock.line7Cents)
        assertEq(withStock.line8ShortTermCents, withoutStock.line8ShortTermCents)
        assertEq(withStock.line9LongTermCents, withoutStock.line9LongTermCents)
        // And it is a real, non-zero answer — not two zeros agreeing.
        assertEq(withStock.line7Cents, 200000n, '$2,000.00 from box 11')
        assertEq(withStock.line8ShortTermCents, 80000n, '$800.00')
        assertEq(withStock.line9LongTermCents, 120000n, '$1,200.00')
        // The $3,000.00 of stock gain (10,000 - 7,000) appears NOWHERE in
        // Part I, at any line.
        for (const cents of [
            withStock.line2GainColumnCents, withStock.line2LossColumnCents,
            withStock.line3NetGainOrLossCents, withStock.line5Cents, withStock.line7Cents,
        ]) {
            assert(cents !== 300000n, ['the stock sale\'s $3,000.00 gain reached Part I', cents])
        }
    },
}
