/**
 * Form 461 — TAX-40: *Limitation on Business Losses*, §461(l). All sixteen
 * printed lines, one pure function over figures the caller has already
 * computed.
 *
 * Spec:
 * [./todo/limitation-on-business-losses.md](./todo/limitation-on-business-losses.md),
 * written before this file. Everything below cites the printed 2025 `f461.pdf`
 * face (Cat. No. 16654I, "Created 2/26/25"), the 2025 `i461.pdf` instructions
 * (Cat. No. 71453Z, "Dec 10, 2025"), or Rev. Proc. 2024-40 §2.32 — all three
 * fetched and read 2026-08-19.
 *
 * **This module reads no documents.** Its whole input is five already-computed
 * cent figures and a filing status, which is what makes it a form rather than a
 * schedule: `fjs/schedule/1` owns the documents, and printed Form 461 lines 2
 * through 6 are Schedule 1 lines 3, 4, 5, 6 and 1040 line 7a restated. Nothing
 * here re-derives any of them.
 *
 * ## A loss fully allowed computes. A BINDING limitation refuses
 *
 * This is `fjs/form8829`'s asymmetry, and it is reached for the same reason.
 * i461, *Purpose of Form*: *"Taxpayers can't deduct an excess business loss […]
 * in the current year. However, the excess business loss is treated as a net
 * operating loss (NOL) carryover for subsequent years. See Form 172"*, and
 * *Line 16*: *"You'll need to keep a record of your excess business loss from
 * each tax year because it's treated as an NOL carryover for subsequent taxable
 * years."*
 *
 * So a §461(l) that BINDS creates a carryforward out, and this engine holds one
 * tax year.
 *
 * **`fjs/schedule/d` is the apparent counter-precedent, and the distinction is
 * the INBOUND side.** A $10,000 net capital loss ships here: printed Schedule D
 * line 21 caps it at $3,000 and $7,000 carries out, refusing nothing. What makes
 * that safe is that the carryover comes BACK — `vnd.fjs.prior_year_capital_loss`
 * and `fjs/tax/carryover`'s worksheet. Form 8829's carryover comes back on
 * printed lines 25 and 31; §199A(c)(2)'s comes back through
 * `priorYearQualifiedBusinessLossCarryforward`. **§461(l)'s does not come back
 * at all**: it returns as a §172 net operating loss deduction on Schedule 1
 * line 8a, and `netOperatingLossDeduction` is an `fjs/return/scope` refusal with
 * no dialect behind it. An outbound carryforward whose inbound counterpart this
 * engine models may ship; one whose counterpart it refuses may not, because the
 * figure would be created here and could never be used anywhere.
 *
 * {@link excessBusinessLossRefusal} is therefore reached exactly when printed
 * line 16 goes below zero, and the boundary is the printed page's own: line 16
 * is *"Add lines 14 and 15. **If less than zero**, enter the amount from line 16
 * as a positive number on Schedule 1 (Form 1040), line 8p."* At line 14 equal to
 * minus the threshold, line 16 is exactly zero and there is no excess business
 * loss — `< 0n`, never `<= 0n`, and {@link proof} has a fixture sitting on that
 * cent.
 *
 * ## Wages are NOT trade-or-business income here, and printed line 1 says so
 *
 * i461, *Definitions*, *Excess business loss*:
 *
 * > Such excess losses should be determined without regard to any deductions,
 * > gross income, or gains attributable to any trade or business of performing
 * > services of an employee.
 *
 * That sentence is §461(l)(6), and it is why the printed face reads *"1 Reserved
 * for future use"* and i461 says *"Leave line 1 blank."* Revisions of this form
 * for 2018 through 2020 put Form 1040 line 1 — wages — on printed line 1 and then
 * removed the whole of it again on printed line 11; the current revision omits
 * the round trip. **Nothing in this module reads a Form W-2**, and a reading in
 * which box 1 belonged on line 2 would enlarge line 14 by the whole of it and so
 * stop the limitation from ever binding on a wage earner with a side business —
 * which is the taxpayer §461(l) was written for.
 *
 * ## Part II, and the two classifications this engine is entitled to make
 *
 * Printed line 10 removes income or gain on lines 1-8 *"that is not attributable
 * to a trade or business"*; printed line 11 removes losses or deductions on the
 * same lines, *"as a positive figure on this line"*.
 *
 * **Capital gains and losses come out in full**, both directions printed: *"Losses
 * from sales or exchanges of capital assets are not included in the calculation
 * of the total deductions from your trades or businesses. So any such amounts
 * included here in line 3 should be added back on line 11"*, and *"any capital
 * gains not attributable to your trade or business that are included here in
 * line 3 should be added back on line 10."*
 *
 * **This was a determination when it was written and is an ADMISSION now, and
 * Form 4797 is what changed it.** Until TAX-41 every capital transaction this
 * engine could hold was an investment transaction — `vnd.fjs.1099b`,
 * `vnd.fjs.1099div` box 2a, or a Schedule K-1 slice whose §1231 half
 * `fjs/schedule/e` refuses whole — so there was no trade-or-business capital
 * gain for i461's *"lesser of"* cap to bite on. `fjs/form4797` now sends a net
 * §1231 gain to printed Schedule D line 11 and so into 1040 line 7a, which IS a
 * gain attributable to a trade or business, and printed line 10 removes it
 * anyway.
 *
 * It stays that way for a stated reason rather than by omission: splitting it
 * needs the §1231 SHARE of 1040 line 7a, and printed Schedule D does not carry
 * one — it nets that gain against investment losses and caps the result at
 * §1211(b)'s $3,000, so *"any such amounts included here in line 3"* is not a
 * subtraction this module's caller can perform. The safety argument is the one
 * printed just below for Schedule 1 line 5, and it runs the same way: removing a
 * gain can only make line 14 SMALLER and the limitation MORE likely to bind, so
 * a return that COMPUTES here computes under either reading and one that refuses
 * may be refusing where a hand-figured Form 461 would have allowed. An
 * over-refusal, never a wrong number. `fjs/schedule/1`'s
 * `formFourSevenNineSevenLineFourMovesLineFourteenAndLineThreeStillCancels`
 * pins both halves of the contrast, and printed line 4 below is the term that
 * does not cancel.
 *
 * **Schedule 1 line 5 comes out in full too, and that is an admission rather than
 * a determination.** i461's *Trade or business* note: *"If you own an interest in
 * a partnership or S corporation, the trade or business determination is made at
 * that entity's level"* — and nothing on a Schedule K-1 this engine reads records
 * it. A rental that rises to a trade or business and one that does not print on
 * the same Schedule E line.
 *
 * The admission is safe because it is one-directional. Schedule 1 line 5 cannot
 * be negative by the time this form sees it (`fjs/schedule/e/part_i` refuses
 * every rental and royalty loss, `fjs/schedule/e` refuses every Part II and Part
 * III loss), so removing it can only make line 14 SMALLER and the limitation MORE
 * likely to bind. A return whose line 16 is non-negative under this reading is
 * non-negative under every reading, so a return that COMPUTES here computes under
 * either classification; a return whose line 16 is negative refuses. The
 * classification therefore changes no number this module ever hands anyone. Both
 * arms of {@link partTwoAdjustment} are still written out, because the day
 * Schedule E can carry a loss the arithmetic here is already right.
 *
 * ## `filed`, and the $156,500 that is not a limitation
 *
 * i461, *Who Must File*: *"File Form 461 if you're a noncorporate taxpayer […]
 * and either (i) your net losses from all of your trades or businesses are more
 * than $313,000 ($626,000 for taxpayers filing a joint return), or (ii) you would
 * report a loss of more than $156,500 on any one of Form 461, lines 1 through
 * 8."*
 *
 * Test (i) is exactly `line 16 < 0`, which refuses — so in any return this module
 * computes, `filed` is true only through test (ii). That second figure is half
 * the general threshold and is **not** doubled on a joint return: the instructions
 * state one number for every filer. It decides `filed` and nothing else; Part III
 * never reads it. `fjs/tax/params` stores it beside the per-status table rather
 * than in it, for that reason.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString, centsToString } from '../exact/module.f.js'
import { taxParamsByYear, individualFilingStatuses } from '../tax/params/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../tax/params/module.f.js' */

/**
 * A case this module will not compute — the same shape `fjs/form8995`,
 * `fjs/form8829` and `fjs/schedule/1` already return, so a caller threads it
 * through the error arm it already has. No `unmodeled` field: this is a
 * document-data-sufficiency refusal (12.1-CONTEXT.md Decision 2.6's category),
 * never an `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form461Refusal
 */

/**
 * The five already-computed figures printed lines 2 through 6 restate, plus the
 * filing status printed line 15 reads.
 *
 * Every field is named for the line it comes FROM rather than for the Form 461
 * line it lands on, so a caller wiring the wrong schedule into the wrong slot
 * has to misread a name rather than miscount a position — the same convention
 * `fjs/form8995`'s own input typedef uses.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly scheduleOneLine3Cents: bigint,
 *   readonly form1040Line7aCents: bigint,
 *   readonly scheduleOneLine4Cents: bigint,
 *   readonly scheduleOneLine5Cents: bigint,
 *   readonly scheduleOneLine6Cents: bigint,
 * }} Form461Input
 */

/**
 * Form 461's sixteen printed lines, in integer cents, plus `filed`.
 *
 * Lines 1 and 7 are present and permanently zero rather than omitted: i461 says
 * *"Leave line 1 blank"* and *"Leave line 7 blank"*, and the printed face calls
 * both *"Reserved for future use"*. A line the paper prints is a line this
 * module carries — the convention `fjs/schedule/1`'s own line 22 already
 * follows.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly filed: boolean,
 *   readonly line1: bigint, readonly line2: bigint, readonly line3: bigint,
 *   readonly line4: bigint, readonly line5: bigint, readonly line6: bigint,
 *   readonly line7: bigint, readonly line8: bigint, readonly line9: bigint,
 *   readonly line10: bigint, readonly line11: bigint, readonly line12: bigint,
 *   readonly line13: bigint, readonly line14: bigint, readonly line15: bigint,
 *   readonly line16: bigint,
 * }} Form461
 */

/** @typedef {Form461 | Form461Refusal} Form461Outcome */

/**
 * Printed line 15's threshold for one filing status, in cents.
 *
 * Read from `fjs/tax/params` rather than written here, and read PER STATUS
 * rather than as "the general amount, doubled if joint": only
 * `marriedFilingJointly` takes $626,000, and both `marriedFilingSeparately` and
 * `qualifyingSurvivingSpouse` take the full $313,000. That group's own docstring
 * carries the argument and its own proof leaves pin every row.
 * @type {(taxParamSet: TaxParamSet) => (status: IndividualFilingStatus) => bigint}
 */
export const thresholdCents = taxParamSet => status =>
    centsFromString(taxParamSet.excessBusinessLossThreshold.thresholdAmount[status].amount)

/**
 * Printed lines 10 and 11 for ONE printed Part I line, given whether this
 * engine can attribute that line to a trade or business.
 *
 * A positive amount that is NOT attributable goes to line 10; a negative one
 * goes to line 11 as its magnitude, because i461's own CAUTION on line 11 says
 * *"Although losses and deductions are usually entered as negative figures on
 * other forms or worksheets, enter them as a positive figure on this line."*
 * An amount that IS attributable contributes to neither.
 *
 * Both arms are written out even where one is unreachable today — see this
 * module's docstring, "Part II".
 * @type {(input: { readonly amountCents: bigint, readonly attributableToATradeOrBusiness: boolean }) => { readonly line10: bigint, readonly line11: bigint }}
 */
export const partTwoAdjustment = input => {
    const { amountCents, attributableToATradeOrBusiness } = input
    if (attributableToATradeOrBusiness) {
        return { line10: 0n, line11: 0n }
    }
    return {
        line10: amountCents > 0n ? amountCents : 0n,
        line11: amountCents < 0n ? -amountCents : 0n,
    }
}

/**
 * **Printed line 16 is below zero: there IS an excess business loss.** The
 * refusal, quoting every figure the filer needs to carry the answer themselves.
 *
 * The message names printed line 8p (where the disallowed amount goes THIS
 * year), Form 172 (where it goes NEXT year), and `netOperatingLossDeduction`
 * (the `fjs/return/scope` refusal that is the reason this cannot ship) — see
 * this module's docstring for the full argument.
 * @type {(input: { readonly line14: bigint, readonly line15: bigint, readonly line16: bigint }) => Form461Refusal}
 */
export const excessBusinessLossRefusal = input => {
    const { line14, line15, line16 } = input
    return {
        kind: 'error',
        message: `Form 461 line 16 is ${centsToString(line16)}, which is below zero, so §461(l) `
            + `BINDS and ${centsToString(-line16)} of this year's business loss is an EXCESS `
            + `BUSINESS LOSS. Printed line 14 (your trade or business income and deductions, `
            + `aggregated) is ${centsToString(line14)} against printed line 15's threshold of `
            + `${centsToString(line15)}. i461 says to "enter the amount from line 16 as a positive `
            + `number on Schedule 1 (Form 1040), line 8p" and that the disallowed amount "is `
            + `treated as a net operating loss (NOL) carryover for subsequent years. See Form `
            + `172". This engine holds ONE tax year and models no net operating loss in either `
            + `direction: Schedule 1 line 8a is the netOperatingLossDeduction fjs/return/scope `
            + `refusal and no dialect carries an NOL. So a return that computed this would add `
            + `the disallowed amount back correctly for 2025 and then silently destroy the `
            + `carryover it created, which is fjs/form8829 line 43's refusal reached the same `
            + `way. A business loss FULLY ALLOWED by §461(l) computes; one the limitation LIMITS `
            + `refuses. Reduce the loss below the threshold, or file Form 461 and Form 172 by `
            + `hand (Form 172 and the §172 net operating loss, no phase yet)`,
    }
}

/**
 * Printed Form 461, complete.
 *
 * `filed` follows i461's *Who Must File*, both clauses. Clause (i) — net losses
 * from all trades or businesses more than the threshold — is arithmetically
 * identical to `line16 < 0n`, so it is written as that rather than as a second
 * comparison that could drift from the one {@link excessBusinessLossRefusal}
 * fires on. Clause (ii) is the $156,500 single-line test, applied to each of
 * printed lines 1 through 8 SEPARATELY, exactly as the instruction says: *"you
 * would report a loss of more than $156,500 on any ONE of Form 461, lines 1
 * through 8."*
 * @type {(taxParamSet: TaxParamSet) => (input: Form461Input) => Form461Outcome}
 */
export const form461 = taxParamSet => input => {
    const {
        status, scheduleOneLine3Cents, form1040Line7aCents, scheduleOneLine4Cents,
        scheduleOneLine5Cents, scheduleOneLine6Cents,
    } = input
    // ── Part I: Total Income/Loss Items ─────────────────────────────────────
    //
    // 1. "Reserved for future use." i461: "Leave line 1 blank." This is where
    //    the 2018-2020 revisions put Form 1040 line 1 — wages — and §461(l)(6)
    //    is why it is not here now. See this module's docstring.
    const line1 = 0n
    // 2. "Enter amount from Schedule 1 (Form 1040), line 3." Schedule C line 31.
    const line2 = scheduleOneLine3Cents
    // 3. "Enter amount from Form 1040 or 1040-SR, line 7a." The capital gain or
    //    loss, which Part II removes again in full — see the docstring.
    const line3 = form1040Line7aCents
    // 4. "Enter amount from Schedule 1 (Form 1040), line 4." Other gains and
    //    losses, Form 4797 line 18b. **Live as of TAX-41** — it was a documented
    //    zero when this module was written, threaded rather than written as `0n`
    //    against exactly that day, and `fjs/schedule/1` forms printed line 4
    //    before it calls this function. Nothing in Part II removes it: a §1231
    //    gain or loss IS attributable to a trade or business, which is what
    //    §1231 property means.
    const line4 = scheduleOneLine4Cents
    // 5. "Enter amount from Schedule 1 (Form 1040), line 5." Schedule E line 41.
    const line5 = scheduleOneLine5Cents
    // 6. "Enter amount from Schedule 1 (Form 1040), line 6." Schedule F line 34,
    //    and the ONE line on this form that can carry a loss today.
    const line6 = scheduleOneLine6Cents
    // 7. "Reserved for future use." i461: "Leave line 7 blank."
    const line7 = 0n
    // 8. "Enter other income, gain, or losses from a trade or business not
    //    reported on lines 1 through 7." A structural zero: every Schedule 1
    //    line 8 sub-line is an `fjs/return/scope` refusal, so no trade-or-
    //    business amount can reach a return here without the scope guard having
    //    already stopped it.
    const line8 = 0n
    // 9. "Combine lines 1 through 8."
    const line9 = line1 + line2 + line3 + line4 + line5 + line6 + line7 + line8
    // ── Part II: Adjustment for Amounts Not Attributable to Trade or Business
    //
    // Two contributions, each through the one shared helper so the sign rule is
    // written once. Schedule C (line 2) and Schedule F (line 6) ARE trades or
    // businesses and contribute nothing here; lines 1, 4, 7 and 8 are zero, so
    // whichever arm they took would contribute nothing either.
    const capital = partTwoAdjustment({
        amountCents: line3, attributableToATradeOrBusiness: false,
    })
    const supplemental = partTwoAdjustment({
        amountCents: line5, attributableToATradeOrBusiness: false,
    })
    // 10. "Enter any income or gain reported on lines 1 through 8 that is not
    //     attributable to a trade or business."
    const line10 = capital.line10 + supplemental.line10
    // 11. "Enter any losses or deductions reported on lines 1 through 8 that are
    //     not attributable to a trade or business." As a POSITIVE figure.
    const line11 = capital.line11 + supplemental.line11
    // 12. "Subtract line 11 from line 10."
    const line12 = line10 - line11
    // ── Part III: Limitation on Losses ──────────────────────────────────────
    //
    // 13. "If line 12 is a negative number, enter it here as a positive number.
    //     If line 12 is a positive number, enter it here as a negative number."
    //     A sign flip, written as one rather than as a two-armed conditional:
    //     the printed sentence has two clauses because the paper form cannot
    //     print a unary minus, not because zero behaves differently.
    const line13 = -line12
    // 14. "Add lines 9 and 13." What is left is the trade-or-business net, which
    //     is what §461(l)(3)(A) measures.
    const line14 = line9 + line13
    // 15. "Enter $313,000 (or $626,000 if married filing jointly)." Per status,
    //     from `fjs/tax/params`, entered POSITIVE as the printed line does.
    const line15 = thresholdCents(taxParamSet)(status)
    // 16. "Add lines 14 and 15. If less than zero, enter the amount from line 16
    //     as a positive number on Schedule 1 (Form 1040), line 8p."
    const line16 = line14 + line15
    if (line16 < 0n) {
        return excessBusinessLossRefusal({ line14, line15, line16 })
    }
    // i461 *Who Must File*, clause (ii): "a loss of more than $156,500 on any
    // one of Form 461, lines 1 through 8". Applied per line, and the figure is
    // NOT per status — see this module's docstring.
    const singleLineTest = centsFromString(
        taxParamSet.excessBusinessLossThreshold.singleLineFilingTest.amount)
    const partOneLines = [line1, line2, line3, line4, line5, line6, line7, line8]
    const anySingleLineLossIsLarge = partOneLines.some(amount => -amount > singleLineTest)
    return {
        kind: 'ok',
        // Clause (i) is `line16 < 0n`, which cannot be reached here — the
        // refusal above has already returned. It is written as `false` with this
        // comment rather than as a dead comparison, because a comparison that
        // can never be true is a claim a reader has to re-derive.
        filed: anySingleLineLossIsLarge,
        line1, line2, line3, line4, line5, line6, line7, line8, line9,
        line10, line11, line12, line13, line14, line15, line16,
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** TY2025's parameter set, narrowed exactly ONCE at module scope. */
const params2025 = taxParamsByYear[2025]
assert(params2025 !== undefined, 'TY2025 parameters must exist')

/** Every Part I input at zero, so each leaf below states only what it varies.
 * @type {Form461Input}
 */
const allZero = {
    status: 'single',
    scheduleOneLine3Cents: 0n,
    form1040Line7aCents: 0n,
    scheduleOneLine4Cents: 0n,
    scheduleOneLine5Cents: 0n,
    scheduleOneLine6Cents: 0n,
}

/** The `ok` arm, or a thrown refusal message — never a silent skip.
 * @type {(outcome: Form461Outcome) => Form461}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 461 to compute', outcome])
    return outcome
}

/** The refusal message, or a throw — never a silent skip.
 * @type {(outcome: Form461Outcome) => string}
 */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected Form 461 to refuse', outcome])
    return outcome.message
}

export const proof = {
    // ── The threshold, per status, from the printed line ────────────────────
    //
    // Hand-typed in cents from f461's printed line 15 and Rev. Proc. 2024-40
    // §2.32, NOT read back out of `fjs/tax/params`. The count is asserted
    // beside the loop, because `individualFilingStatuses` is the iteration set
    // and a status dropped from it would vanish from this loop in the same
    // instant.
    printedLineFifteenPerStatus: () => {
        /** @type {Record<IndividualFilingStatus, bigint>} */
        const printed = {
            single: 31300000n,
            marriedFilingJointly: 62600000n,
            marriedFilingSeparately: 31300000n,
            headOfHousehold: 31300000n,
            qualifyingSurvivingSpouse: 31300000n,
        }
        assertEq(Object.keys(printed).length, 5, 'five statuses hand-typed')
        assertEq(individualFilingStatuses.length, 5, 'and five statuses to look up')
        for (const status of individualFilingStatuses) {
            assertEq(thresholdCents(params2025)(status), printed[status], status)
        }
    },
    // ── THE BOUNDARY, from three sides ─────────────────────────────────────
    //
    // A single filer whose only trade or business is a farm. $313,000.00 of
    // loss puts line 14 at exactly minus the threshold, so line 16 is exactly
    // zero — "if LESS than zero" is not satisfied and the whole loss is
    // allowed. Hand-computed: 31,300,000 cents of loss + 31,300,000 of
    // threshold = 0.
    exactlyAtTheThresholdComputesAndLineSixteenIsZero: () => {
        const result = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -31300000n,
        }))
        assertEq(result.line9, -31300000n, 'printed line 9 is the farm loss alone')
        assertEq(result.line10, 0n, 'nothing to remove')
        assertEq(result.line11, 0n)
        assertEq(result.line12, 0n)
        assertEq(result.line13, 0n)
        assertEq(result.line14, -31300000n, 'the trade-or-business net')
        assertEq(result.line15, 31300000n, '$313,000.00')
        assertEq(result.line16, 0n, 'exactly zero, which is NOT less than zero')
        assertEq(result.filed, true, 'clause (ii): one line carries a loss over $156,500.00')
    },
    // ONE CENT more of loss, and it refuses. The boundary from the other side,
    // and the leaf a `<= 0n` written for `< 0n` would fail.
    oneCentBeyondTheThresholdRefuses: () => {
        const message = expectRefusal(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -31300001n,
        }))
        // **The SIGNS, as one contiguous phrase.** `includes('0.01')` alone is
        // satisfied by the string `-0.01` too, so dropping the negation in
        // `centsToString(-line16)` — printing the excess as a NEGATIVE amount
        // the filer is then told to enter "as a positive number on line 8p" —
        // survived every other assertion in this leaf. AGENTS.md's own
        // "erasing a string interpolation" mutation, found by running it.
        assert(
            message.includes('line 16 is -0.01, which is below zero, so §461(l) '
                + 'BINDS and 0.01 of this year'),
            ['line 16 negative, the excess POSITIVE, in one phrase', message])
        assert(message.includes('313000.00'), ['the threshold must be quoted', message])
        assert(message.includes('-313000.01'), ['and printed line 14', message])
        assert(message.includes('line 8p'), ['where the amount would have gone', message])
        assert(message.includes('Form 172'), ['and where it goes next year', message])
        assert(message.includes('netOperatingLossDeduction'),
            ['the refusal that is the actual reason', message])
    },
    // ONE CENT under, and it computes with a cent of room. The control for the
    // refusal: a gate that refused everything would fail here.
    oneCentInsideTheThresholdComputes: () => {
        const result = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -31299999n,
        }))
        assertEq(result.line16, 1n, 'one cent of room left under §461(l)')
    },
    // ── The joint threshold is not reached by doubling anything here ────────
    //
    // The SAME $500,000.00 farm loss: a single filer is over $313,000.00 and
    // refuses, a joint filer is under $626,000.00 and computes with
    // $126,000.00 of room. Hand-computed: 62,600,000 - 50,000,000 = 12,600,000.
    theSameLossRefusesSingleAndComputesJointly: () => {
        const single = expectRefusal(form461(params2025)({
            ...allZero, status: 'single', scheduleOneLine6Cents: -50000000n,
        }))
        assert(single.includes('187000.00'), ['$500,000.00 - $313,000.00 = $187,000.00', single])
        const joint = expectOk(form461(params2025)({
            ...allZero, status: 'marriedFilingJointly', scheduleOneLine6Cents: -50000000n,
        }))
        assertEq(joint.line15, 62600000n, '$626,000.00')
        assertEq(joint.line16, 12600000n, '$126,000.00 of room')
    },
    // **THE TWO PER-STATUS TRAPS, as a difference in OUTCOME rather than as a
    // difference in a stored string.** One $400,000.00 loss across three
    // statuses: married filing SEPARATELY and a QUALIFYING SURVIVING SPOUSE
    // both refuse with an $87,000.00 excess (so MFS was not halved and QSS was
    // not doubled), while married filing JOINTLY computes with room to spare.
    // A table edit that halved MFS or doubled QSS reddens here and not only in
    // `fjs/tax/params`.
    marriedFilingSeparatelyAndSurvivingSpouseTakeTheGeneralThreshold: () => {
        // $400,000.00 of loss. MFS threshold is the FULL $313,000.00, so the
        // excess is $87,000.00 — if it had been halved to $156,500.00 the
        // excess would be $243,500.00 instead, so the quoted figure is what
        // distinguishes the two.
        const separate = expectRefusal(form461(params2025)({
            ...allZero, status: 'marriedFilingSeparately', scheduleOneLine6Cents: -40000000n,
        }))
        assert(separate.includes('87000.00'),
            ['MFS takes the FULL $313,000.00, so the excess is $87,000.00', separate])
        assert(!separate.includes('243500.00'), ['and NOT a halved threshold', separate])
        // A surviving spouse does not file a joint return, so the same loss is
        // over the threshold for that status too — where the joint filer is not.
        const survivingSpouse = expectRefusal(form461(params2025)({
            ...allZero, status: 'qualifyingSurvivingSpouse', scheduleOneLine6Cents: -40000000n,
        }))
        assert(survivingSpouse.includes('87000.00'),
            ['QSS takes $313,000.00, not $626,000.00', survivingSpouse])
        const joint = expectOk(form461(params2025)({
            ...allZero, status: 'marriedFilingJointly', scheduleOneLine6Cents: -40000000n,
        }))
        assertEq(joint.line16, 22600000n, 'the joint filer has $226,000.00 of room')
    },
    // ── Part II: the capital-gain and capital-loss round trips ──────────────
    //
    // A $3,000.00 capital LOSS on 1040 line 7a is added back on printed line 11
    // and leaves line 14 untouched, so it can never create an excess business
    // loss. i461: "Losses from sales or exchanges of capital assets are not
    // included in the calculation of the total deductions from your trades or
    // businesses."
    aCapitalLossIsRemovedOnPrintedLineEleven: () => {
        const result = expectOk(form461(params2025)({
            ...allZero, form1040Line7aCents: -300000n, scheduleOneLine6Cents: -31300000n,
        }))
        assertEq(result.line3, -300000n, '$3,000.00 of capital loss on printed line 3')
        assertEq(result.line9, -31600000n, 'which makes printed line 9 $316,000.00 of loss')
        assertEq(result.line11, 300000n, 'and comes straight back on line 11, POSITIVE')
        assertEq(result.line10, 0n, 'never on line 10')
        assertEq(result.line12, -300000n)
        assertEq(result.line13, 300000n)
        assertEq(result.line14, -31300000n, 'so line 14 is the farm loss alone')
        assertEq(result.line16, 0n, 'and the boundary is exactly where it was without it')
    },
    // A $50,000.00 capital GAIN is removed on printed line 10 and does NOT
    // offset the business loss. Without the removal, line 14 would be
    // $50,000.00 larger and a loss that must refuse would compute — which is
    // the direction that understates tax.
    aCapitalGainIsRemovedOnPrintedLineTenAndDoesNotShelterALoss: () => {
        const message = expectRefusal(form461(params2025)({
            ...allZero, form1040Line7aCents: 5000000n, scheduleOneLine6Cents: -31300001n,
        }))
        assert(message.includes('-313000.01'),
            ['printed line 14 is the farm loss alone; the $50,000.00 gain was removed', message])
        // The control: the same gain WITH a loss one cent smaller computes, so
        // this leaf is not merely observing that everything refuses.
        const result = expectOk(form461(params2025)({
            ...allZero, form1040Line7aCents: 5000000n, scheduleOneLine6Cents: -31300000n,
        }))
        assertEq(result.line9, -26300000n, 'printed line 9 nets the gain against the loss')
        assertEq(result.line10, 5000000n, 'and printed line 10 takes the gain back out')
        assertEq(result.line14, -31300000n, 'leaving the trade-or-business net alone')
    },
    // Schedule 1 line 5 is removed the same way, and the leaf states the
    // DIRECTION that makes the admission safe: removing it can only make the
    // limitation bite harder, never softer.
    scheduleEIncomeIsRemovedAndCanOnlyMakeTheLimitationBiteHarder: () => {
        const withScheduleE = expectRefusal(form461(params2025)({
            ...allZero, scheduleOneLine5Cents: 8000000n, scheduleOneLine6Cents: -31300001n,
        }))
        assert(withScheduleE.includes('-313000.01'),
            ['the $80,000.00 of Schedule E income does not shelter the farm loss', withScheduleE])
        // The control: without the Schedule E income the verdict is identical,
        // which is the whole point — the classification changes no answer.
        const withoutScheduleE = expectRefusal(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -31300001n,
        }))
        assertEq(withScheduleE, withoutScheduleE,
            'the two returns get character-for-character the same refusal')
    },
    // Schedule C's profit IS attributable, and this is the leaf that would fail
    // if `partTwoAdjustment` were called for printed line 2 as well. A
    // $100,000.00 Schedule C profit must OFFSET a farm loss, because both are
    // trades or businesses and §461(l)(3)(A) aggregates them.
    //
    // (No return can carry both today — `fjs/schedule/f` refuses a farm beside
    // a business record — so this leaf exercises the arithmetic rather than a
    // reachable return. It is here because the arithmetic is what a future
    // phase will rely on, and because deleting the `line2` term from line 9
    // would otherwise go unnoticed.)
    aTradeOrBusinessProfitOffsetsATradeOrBusinessLoss: () => {
        const result = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine3Cents: 10000000n, scheduleOneLine6Cents: -40000000n,
        }))
        assertEq(result.line9, -30000000n, '$400,000.00 of loss less $100,000.00 of profit')
        assertEq(result.line10, 0n, 'a trade-or-business profit is NOT removed on line 10')
        assertEq(result.line14, -30000000n)
        assertEq(result.line16, 1300000n, '$13,000.00 under the threshold, so it computes')
    },
    // ── `filed`, both clauses ──────────────────────────────────────────────
    //
    // i461's clause (ii) is per LINE and is not doubled on a joint return. A
    // $156,500.00 loss on one line is exactly the test's own figure and does
    // NOT trip it ("more than"); one cent more does.
    theSingleLineFilingTestIsStrictAndIsNotPerStatus: () => {
        const exactly = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -15650000n,
        }))
        assertEq(exactly.filed, false, '"more than $156,500" is strict')
        const oneCentMore = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine6Cents: -15650001n,
        }))
        assertEq(oneCentMore.filed, true, 'one cent more and the form is filed')
        // And the SAME loss on a joint return files too: the test is one figure
        // for every status, so doubling it for a joint filer would break this.
        const joint = expectOk(form461(params2025)({
            ...allZero, status: 'marriedFilingJointly', scheduleOneLine6Cents: -15650001n,
        }))
        assertEq(joint.filed, true, 'clause (ii) is not doubled on a joint return')
    },
    // A return with no business loss at all computes and is NOT filed — the
    // control for `filed`, without which a `filed: true` constant would pass.
    anOrdinaryReturnIsNotFiledAndHasNoExcessBusinessLoss: () => {
        const result = expectOk(form461(params2025)({
            ...allZero, scheduleOneLine3Cents: 5000000n, form1040Line7aCents: -300000n,
        }))
        assertEq(result.filed, false, 'nothing on lines 1-8 is a loss over $156,500.00')
        assertEq(result.line14, 5000000n, 'the Schedule C profit, with the capital loss removed')
        assertEq(result.line16, 36300000n, '$50,000.00 + $313,000.00')
    },
    // ── Lines 1 and 7 are printed and blank, not omitted ────────────────────
    //
    // Wages are the thing that is NOT on this form, and the assertion is about
    // the printed line rather than about an absent parameter: line 1 must be
    // zero for every input this module accepts, because no input carries wages
    // at all.
    printedLinesOneAndSevenAreAlwaysBlank: () => {
        const result = expectOk(form461(params2025)({
            ...allZero,
            scheduleOneLine3Cents: 12345678n,
            form1040Line7aCents: -300000n,
            scheduleOneLine5Cents: 999n,
        }))
        assertEq(result.line1, 0n, 'i461: "Leave line 1 blank"')
        assertEq(result.line7, 0n, 'i461: "Leave line 7 blank"')
        assertEq(result.line8, 0n, 'and no trade-or-business amount can reach line 8')
    },
    // ── `partTwoAdjustment`'s own sign rule, both arms ─────────────────────
    theTradeOrBusinessArmContributesToNeitherPrintedLine: () => {
        const gain = partTwoAdjustment({
            amountCents: 5000000n, attributableToATradeOrBusiness: true,
        })
        assertEq(gain.line10, 0n)
        assertEq(gain.line11, 0n)
        const loss = partTwoAdjustment({
            amountCents: -5000000n, attributableToATradeOrBusiness: true,
        })
        assertEq(loss.line10, 0n)
        assertEq(loss.line11, 0n)
    },
    aLossReachesPrintedLineElevenAsAPositiveFigure: () => {
        const loss = partTwoAdjustment({
            amountCents: -300000n, attributableToATradeOrBusiness: false,
        })
        assertEq(loss.line10, 0n)
        assertEq(loss.line11, 300000n, 'i461 CAUTION: "enter them as a positive figure"')
        const zero = partTwoAdjustment({
            amountCents: 0n, attributableToATradeOrBusiness: false,
        })
        assertEq(zero.line10, 0n, 'zero is neither an income nor a loss')
        assertEq(zero.line11, 0n)
    },
}
