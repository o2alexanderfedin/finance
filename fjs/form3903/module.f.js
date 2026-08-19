/**
 * **Form 3903 (TY2025) — Moving Expenses.** All five printed lines, named and
 * computed, plus the one refusal this form makes unavoidable.
 *
 * Sources, fetched and read directly (2026-08-18), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f3903.pdf` — the 2025 form, Cat. No.
 *   12490K.
 * - `https://www.irs.gov/pub/irs-pdf/i3903.pdf` — the 2025 instructions,
 *   Catalog Number 64324D.
 *
 * See `fjs/form3903/todo/moving-expenses.md` for the full argument and every
 * printed caption transcribed. The claims that decide this module's SHAPE are
 * repeated here, because they decide every line of it.
 *
 * ## Who may file — and why that is not modelled here
 *
 * §217 was suspended by TCJA §11049 for everybody except the case §217(g)
 * leaves standing, which the form states in its own pre-line caption: *"You
 * can deduct moving expenses only if you are a Member of the Armed Forces on
 * active duty and, due to a military order, you, your spouse, or your
 * dependents move because of a permanent change of station."* The 2025 form
 * adds a checkbox to certify it.
 *
 * A checkbox is a taxpayer attestation with no document behind it — no dialect
 * in this engine carries "active duty" or "permanent change of station" — so
 * the eligibility gate belongs with the taxpayer facts on
 * `vnd.fjs.return_profile` and NOT in this arithmetic. A caller that hands a
 * civilian's move to this module gets a number the law does not allow. That is
 * the caller's rule to enforce, stated here so nobody concludes from a green
 * proof that this module checked.
 *
 * **The caller now exists, and the field it gates on is named.**
 * `fjs/schedule/1` reads
 * `movingExpensesArmedForcesPermanentChangeOfStation` — Form 3903's own
 * pre-line checkbox, stored as `option(true)` like every other certification
 * on that dialect — and REFUSES rather than computing when a moving expense or
 * a box 12 code P reimbursement reaches line 14 without it. This paragraph
 * originally pointed at `fjs/return/profile`'s `movingExpensesArmedForces`
 * KIND, which was the wrong home: `declaredKinds` is a scope declaration, and
 * no computation module here gates a figure on it.
 *
 * ## This module reads no document
 *
 * It takes three `bigint` cent figures and returns the five printed lines, the
 * shape `fjs/form8959` and `fjs/schedule/1a`'s Part V already have. Document
 * collection — summing W-2 box 12 code P across every stored form — happens in
 * the caller, where the documents are, so DOC-11's absent-is-absent rule is
 * applied once. {@link movingExpensesLine4W2Box12Codes} is exported so the
 * caller's code match and this module's specification cannot drift apart.
 *
 * ## Meals are excluded, and the exclusion is the caller's
 *
 * Line 2's printed caption ends *"Do not include the cost of meals"*, and the
 * instructions say it twice more. This module takes line 2 as an ALREADY-NET
 * figure and has no meals input; it must not grow one, because a line-2 figure
 * that arrived with meals in it is indistinguishable, here, from one that did
 * not. The exclusion is enforced where the figure is assembled — exactly as
 * line 1's own long list of non-deductibles (the purchase price of the new
 * home, car tags, lease-breaking, security deposits, real-estate taxes) is.
 *
 * ## THE TRAP: line 4 > line 3 is TAXABLE INCOME, not a zero deduction
 *
 * The printed line 5 asks *"Is line 3 more than line 4?"* and its **No** branch
 * reads: *"You cannot deduct your moving expenses. If line 3 is less than line
 * 4, subtract line 3 from line 4 and include the result on Form 1040, 1040-SR,
 * or 1040-NR, **line 1h**."* `i3903.pdf` says it a second time under *Services
 * or reimbursements provided by government*: the excess *"still must be
 * included in gross income on Form 1040, 1040-SR, or 1040-NR, line 1h."*
 *
 * **The destination is 1040 line 1h — "other earned income" — NOT Schedule 1
 * line 8z**, and the difference is not cosmetic. Line 1h sits inside 1040 line
 * 1z, so the excess is EARNED income: it feeds the earned income credit, the
 * additional child tax credit and a dependent's standard-deduction floor.
 * Schedule 1 line 8z lands on 1040 line 8 and is not earned income at all.
 *
 * `fjs/return/scope` holds that line as the **refused** `otherEarnedIncome`
 * kind, and `fjs/form1040/core` sets `line1h` to a `declaredZero`. So a return
 * whose reimbursement exceeds its expenses carries gross income this engine has
 * nowhere to put. Returning a zero deduction — which is what the printed page
 * tells a HUMAN to enter on line 5 — would emit a complete-looking Form 1040
 * that silently omits it and **understates the tax**. Returning the negative as
 * a deduction understates it twice over. So it REFUSES, and the message names
 * the amount and the line it would have gone on, because that is the only part
 * of a refusal a reader can act on.
 *
 * **When `otherEarnedIncome` is ever modelled, this refusal becomes wrong** and
 * the No branch should compute the line-1h inclusion instead. The message says
 * so, so the day that changes, the string that has to change says why.
 *
 * ## Equality is NOT the refusal
 *
 * `i3903.pdf`'s *Line 5* spells the boundary out: *"If line 3 is equal to or
 * less than line 4, you don't have a moving expense deduction. Subtract line 3
 * from line 4 and, if the result is more than zero, enter it on Form 1040,
 * 1040-SR, or 1040-NR, line 1h."* At equality the subtraction yields zero,
 * which is not *more than zero*, so nothing is reported anywhere: a perfectly
 * reimbursed move is a complete, computable return with a zero deduction. The
 * refusal is therefore gated STRICTLY on `line4 > line3`.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsToString } from '../exact/module.f.js'

/**
 * The three figures Form 3903 asks a filer for. Integer cents, per the money
 * rule: no floats anywhere in a computation.
 * @typedef {{
 *   readonly transportationAndStorageCents: bigint,
 *   readonly travelAndLodgingCents: bigint,
 *   readonly governmentPaymentsNotInBox1Cents: bigint,
 * }} MovingExpensesInput
 */

/**
 * The graceful, tagged refusal — the shape every form module in this engine
 * returns and no module throws. A caller threads `message` out verbatim.
 * @typedef {{ readonly kind: 'error', readonly message: string }} MovingExpensesError
 */

/**
 * Form 3903's five printed lines, each under its printed number. A record, not
 * an array: a caller wiring Schedule 1 line 14 wants `line5` by name, and a
 * positional read of this form has no meaning.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: bigint,
 *   readonly line2: bigint,
 *   readonly line3: bigint,
 *   readonly line4: bigint,
 *   readonly line5: bigint,
 * }} MovingExpensesLines
 */

/** @typedef {MovingExpensesLines | MovingExpensesError} MovingExpensesOutcome */

/**
 * **The W-2 box 12 code line 4 is reported under: `P`, and only `P`.**
 *
 * Line 4's printed caption names it on the form's own face — *"This amount
 * should be shown in box 12 of your Form W-2 with code P"* — and the
 * instructions repeat it. Code P is *excludable moving expense reimbursements
 * paid directly to a member of the Armed Forces*, which is the same population
 * §217(g) leaves eligible; no other box 12 code is a moving reimbursement.
 *
 * Exported, hand-typed and typed as `readonly string[]` so the caller that
 * sums `vnd.fjs.w2`'s coded rows can hold THIS array as its match list rather
 * than writing `'P'` a second time (AGENTS.md, "one rule, one place"). A list
 * rather than a bare string because the printed vocabulary is a list, and
 * because a second code would have to be added to the caller's gate and to
 * this specification together.
 * @type {readonly string[]}
 */
export const movingExpensesLine4W2Box12Codes = ['P']

/**
 * The three inputs, paired with the printed line each one is, for the
 * negative-input refusal below. Hand-typed here and hand-typed again in the
 * proof, deliberately: a proof that built its cases from this table could not
 * notice the table shrinking.
 * @type {(input: MovingExpensesInput) => readonly { readonly line: string, readonly what: string, readonly cents: bigint }[]}
 */
const printedInputs = input => [
    {
        line: 'line 1',
        what: 'transportation and storage of household goods and personal effects',
        cents: input.transportationAndStorageCents,
    },
    {
        line: 'line 2',
        what: 'travel and lodging from the old home to the new home',
        cents: input.travelAndLodgingCents,
    },
    {
        line: 'line 4',
        what: 'the amount the government paid that is not in W-2 box 1 (box 12 code P)',
        cents: input.governmentPaymentsNotInBox1Cents,
    },
]

/**
 * Form 3903, all five lines — or the refusal the return forces.
 *
 * Two refusals, in the order they are checked:
 *
 * 1. **A negative input.** Lines 1, 2 and 4 are two expenses and a
 *    reimbursement; none can be negative on the printed page, and this form
 *    carries no *"-0-"* clause and no parentheses box anywhere. A negative
 *    arriving here is a transcription or wiring error, and it is expensive in
 *    both directions: a negative line 4 INFLATES the deduction, because
 *    `line3 - (-x)` exceeds line 3, and a negative line 1 or 2 shrinks a real
 *    one. Zero is legitimate and does not refuse.
 * 2. **Line 4 greater than line 3** — the trap, argued at length in this
 *    module's docstring.
 *
 * @type {(input: MovingExpensesInput) => MovingExpensesOutcome}
 */
export const movingExpenses = input => {
    for (const printed of printedInputs(input)) {
        if (printed.cents < 0n) {
            return {
                kind: 'error',
                message: `Form 3903 ${printed.line} is NEGATIVE ($${centsToString(printed.cents)}): `
                    + `${printed.what}. Every figure on this form is an expense paid or a `
                    + `reimbursement received, and the printed page carries no '-0-' clause and no `
                    + `parentheses box — a negative here is a transcription or wiring error, not a `
                    + `taxpayer fact. Computing it would move real money: a negative line 4 `
                    + `INFLATES the deduction, because subtracting a negative adds. Supply the `
                    + `figure as printed, or zero if there was none.`,
            }
        }
    }

    // 1 — Transportation and storage of household goods and personal effects.
    const line1 = input.transportationAndStorageCents
    // 2 — Travel (including lodging) from the old home to the new home. The
    // caller has already excluded meals; see this module's docstring.
    const line2 = input.travelAndLodgingCents
    // 3 — "Add lines 1 and 2".
    const line3 = line1 + line2
    // 4 — What the government paid for the lines 1 and 2 expenses that is not
    // in W-2 box 1; W-2 box 12 code P.
    const line4 = input.governmentPaymentsNotInBox1Cents

    // 5 — "Is line 3 more than line 4?" STRICTLY more: at equality the
    // instructions give a zero deduction and nothing to report on line 1h,
    // because the 1h subtraction must be "more than zero".
    if (line4 > line3) {
        const excess = line4 - line3
        return {
            kind: 'error',
            message: `Form 3903: the government paid $${centsToString(line4)} toward this move `
                + `(W-2 box 12 code P) but the deductible expenses on lines 1 and 2 total only `
                + `$${centsToString(line3)}. The $${centsToString(excess)} excess is NOT a zero `
                + `deduction — it is TAXABLE INCOME. Form 3903 line 5 and i3903.pdf both say to `
                + `"include the result on Form 1040, 1040-SR, or 1040-NR, line 1h", and 1040 `
                + `line 1h is other earned income, which this engine REFUSES: no dialect models `
                + `it (the otherEarnedIncome kind in fjs/return/scope), and fjs/form1040/core `
                + `declares line 1h a zero. So there is nowhere here to put $${centsToString(excess)} `
                + `of gross income, and returning a zero moving expense deduction instead would `
                + `drop it silently and UNDERSTATE the tax. Note this is line 1h, inside 1040 `
                + `line 1z — earned income that feeds the earned income credit — and NOT `
                + `Schedule 1 line 8z. When otherEarnedIncome is modelled, this refusal must `
                + `become that computation.`,
        }
    }
    return { kind: 'ok', line1, line2, line3, line4, line5: line3 - line4 }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * Unwraps a computed form, throwing the refusal if there was one.
 * @type {(outcome: MovingExpensesOutcome) => MovingExpensesLines}
 */
const expectLines = outcome => {
    assert(outcome.kind === 'ok', ['expected Form 3903 to compute', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected Form 3903 to compute', outcome]
    }
    return outcome
}

/**
 * Unwraps a refusal, throwing the computed form if there was not one.
 * @type {(outcome: MovingExpensesOutcome) => string}
 */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') {
        throw ['expected a refusal', outcome]
    }
    return outcome.message
}

export const proof = {
    /**
     * **Line 1** is taken as given: transportation and storage, one figure.
     * Asserted on its own so a mutation to line 1's pass-through reddens a
     * leaf that says "line 1" and not only the ones downstream of it.
     */
    lineOneIsTransportationAndStorage: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 0n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        assertEq(form.line1, 483750n, '$4,837.50 of packing, crating, hauling and in-transit storage')
        assertEq(form.line2, 0n, 'no travel claimed')
    },
    /**
     * **Line 2** is taken as given: travel and lodging, one figure.
     */
    lineTwoIsTravelAndLodging: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 0n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        assertEq(form.line2, 129940n, '$1,299.40 of driving, tolls and one night of lodging')
        assertEq(form.line1, 0n, 'nothing shipped')
    },
    /** **Line 3** — "Add lines 1 and 2". */
    lineThreeAddsLinesOneAndTwo: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        // $4,837.50 + $1,299.40 = $6,136.90, added by hand.
        assertEq(form.line3, 613690n, '$6,136.90')
    },
    /**
     * **Line 4** is taken as given: what the government paid that is not in
     * W-2 box 1. Asserted on its own, with no reimbursement large enough to
     * disturb line 5, so a mutation to line 4's pass-through is visible
     * independently of the subtraction.
     */
    lineFourIsTheGovernmentPaymentNotInBoxOne: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents: 200000n,
        }))
        assertEq(form.line4, 200000n, '$2,000.00 reported in W-2 box 12 code P')
    },
    /**
     * **Line 5, the deduction** — "Subtract line 4 from line 3". A staff
     * sergeant's permanent change of station: $4,837.50 shipped, $1,299.40
     * driven, $2,000.00 reimbursed.
     *
     * $6,136.90 - $2,000.00 = $4,136.90, subtracted by hand.
     */
    lineFiveSubtractsLineFourFromLineThree: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents: 200000n,
        }))
        assertEq(form.line5, 413690n, '$4,136.90 to Schedule 1 line 14')
    },
    /**
     * An UNREIMBURSED move deducts the whole of line 3 — the case where line 4
     * is zero, which is the ordinary one for a service member who paid out of
     * pocket.
     */
    anUnreimbursedMoveDeductsTheWholeOfLineThree: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 1250000n,
            travelAndLodgingCents: 87325n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        // $12,500.00 + $873.25 = $13,373.25, and nothing is subtracted.
        assertEq(form.line3, 1337325n, '$13,373.25')
        assertEq(form.line5, 1337325n, '$13,373.25, deducted in full')
    },
    /** An empty form: every printed line is zero and nothing refuses. */
    aFormWithNothingOnItIsAllZeros: () => {
        const form = expectLines(movingExpenses({
            transportationAndStorageCents: 0n,
            travelAndLodgingCents: 0n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        assertEq(form.line1, 0n)
        assertEq(form.line2, 0n)
        assertEq(form.line3, 0n)
        assertEq(form.line4, 0n)
        assertEq(form.line5, 0n)
    },
    /**
     * **The threshold, at ±1 cent.** `i3903.pdf`'s *Line 5*: *"If line 3 is
     * equal to or less than line 4, you don't have a moving expense
     * deduction. Subtract line 3 from line 4 and, if the result is more than
     * zero, enter it on Form 1040 ... line 1h."*
     *
     * So the boundary is THREE distinct outcomes over three consecutive cents,
     * and all three are asserted here:
     *
     * - line 4 one cent BELOW line 3 — a one-cent deduction, computed;
     * - line 4 EQUAL to line 3 — a zero deduction, computed, NOT refused,
     *   because the line-1h excess would be zero and zero is not *more than
     *   zero*;
     * - line 4 one cent ABOVE line 3 — refused, because one cent of gross
     *   income has nowhere to go.
     *
     * Line 3 is $6,136.90 throughout, so the three line-4 figures are
     * $6,136.89, $6,136.90 and $6,136.91, hand-typed.
     */
    theEqualityBoundaryIsAZeroDeductionAndOneCentMoreRefuses: () => {
        /** @type {(governmentPaymentsNotInBox1Cents: bigint) => MovingExpensesOutcome} */
        const atReimbursement = governmentPaymentsNotInBox1Cents => movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents,
        })
        const justUnder = expectLines(atReimbursement(613689n))
        assertEq(justUnder.line3, 613690n, '$6,136.90')
        assertEq(justUnder.line5, 1n, '$6,136.90 - $6,136.89 = $0.01, a one-cent deduction')

        const exactly = expectLines(atReimbursement(613690n))
        assertEq(exactly.line5, 0n, 'a perfectly reimbursed move: a ZERO deduction, not a refusal')

        const justOver = expectRefusal(atReimbursement(613691n))
        assert(justOver.includes('$0.01'), ['one cent of excess, named', justOver])
        assert(justOver.includes('1040'), ['and the form it belongs on', justOver])
    },
    /**
     * **THE TRAP.** The government paid more than the move cost, so the excess
     * is gross income on 1040 line 1h — a line this engine refuses — and NOT a
     * zero deduction.
     *
     * Every assertion here is about WHAT is refused, not that something was.
     * The destination in particular: AGENTS.md records a `${destination}`
     * erasure surviving an entire suite because five refusal proofs asserted
     * the phrase "cannot compute" and none asserted where the amount would
     * have gone.
     */
    reimbursementExceedingExpensesRefusesAsTaxableIncome: () => {
        // $2,400.00 + $600.00 = $3,000.00 of expenses, $4,500.00 reimbursed;
        // the excess is $1,500.00, subtracted by hand.
        const message = expectRefusal(movingExpenses({
            transportationAndStorageCents: 240000n,
            travelAndLodgingCents: 60000n,
            governmentPaymentsNotInBox1Cents: 450000n,
        }))
        assert(message.includes('$1500.00'), ['name the excess amount', message])
        assert(message.includes('$3000.00'), ['and the line 3 it exceeded', message])
        assert(message.includes('line 1h'), ['name WHERE it would have gone', message])
        assert(message.includes('earned income'), ['and what that line is', message])
        assert(message.includes('otherEarnedIncome'), ['and the refused kind, by name', message])
        assert(message.includes('TAXABLE INCOME'), ['say what the excess IS', message])
        assert(message.includes('UNDERSTATE'), ['and which way the error runs', message])
        assert(message.includes('box 12 code P'), ['and which box the figure came from', message])
        // The correction this module exists to carry: NOT Schedule 1 line 8z.
        assert(message.includes('8z'), ['and rule out the line it is not', message])

        // ── THE CONTROL ──────────────────────────────────────────────────────
        // A gate that refused everything would pass every assertion above. A
        // legitimate, ordinary move — reimbursed, but for less than it cost —
        // must NOT refuse.
        const ordinary = expectLines(movingExpenses({
            transportationAndStorageCents: 240000n,
            travelAndLodgingCents: 60000n,
            governmentPaymentsNotInBox1Cents: 100000n,
        }))
        assertEq(ordinary.line5, 200000n, '$3,000.00 - $1,000.00 = $2,000.00, deducted, not refused')
        // And the wholly unreimbursed move, the other end of the legitimate
        // range, likewise computes.
        assertEq(
            expectLines(movingExpenses({
                transportationAndStorageCents: 240000n,
                travelAndLodgingCents: 60000n,
                governmentPaymentsNotInBox1Cents: 0n,
            })).line5,
            300000n,
            '$3,000.00, deducted in full, not refused')
    },
    /**
     * **Meals.** Line 2's printed caption ends *"Do not include the cost of
     * meals"*, and the input shape expresses that exclusion in exactly one
     * way: there is ONE travel figure and this module adds nothing to it, so
     * whatever the caller hands over IS line 2, meals and all if the caller
     * got it wrong.
     *
     * This leaf pins that contract from both sides. The same trip is priced
     * twice — $1,299.40 net of meals, and $1,499.40 with $200.00 of meals
     * left in — and the two produce deductions $200.00 apart. That is the
     * whole of what this module can say about meals, and saying it here is
     * what stops a future change from quietly adding a `mealsCents` input
     * that this module would then have to subtract twice.
     */
    lineTwoIsNetOfMealsAndThisModuleAddsNothingToIt: () => {
        const net = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 129940n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        assertEq(net.line2, 129940n, '$1,299.40, meals already excluded by the caller')
        assertEq(net.line3, 613690n, '$6,136.90')

        const withMealsLeftIn = expectLines(movingExpenses({
            transportationAndStorageCents: 483750n,
            travelAndLodgingCents: 149940n,
            governmentPaymentsNotInBox1Cents: 0n,
        }))
        // $1,499.40 - $1,299.40 = $200.00 of meals, and the deduction is
        // exactly that much bigger: the module passed line 2 through untouched.
        assertEq(withMealsLeftIn.line5 - net.line5, 20000n,
            '$200.00 of meals, overstating the deduction by exactly $200.00 if the caller leaves them in')
    },
    /**
     * A NEGATIVE figure on any of the three printed inputs refuses, and the
     * message names which line. The three cases are hand-typed rather than
     * built from `printedInputs`, per AGENTS.md: a proof that iterates a
     * collection derived from the code under test cannot notice that
     * collection shrinking.
     */
    aNegativeFigureOnAnyPrintedLineRefuses: () => {
        const zero = {
            transportationAndStorageCents: 0n,
            travelAndLodgingCents: 0n,
            governmentPaymentsNotInBox1Cents: 0n,
        }
        const one = expectRefusal(movingExpenses({ ...zero, transportationAndStorageCents: -1n }))
        assert(one.includes('line 1'), ['name the line', one])
        assert(one.includes('NEGATIVE'), ['and what is wrong with it', one])
        const two = expectRefusal(movingExpenses({ ...zero, travelAndLodgingCents: -1n }))
        assert(two.includes('line 2'), ['name the line', two])
        const four = expectRefusal(movingExpenses({ ...zero, governmentPaymentsNotInBox1Cents: -1n }))
        assert(four.includes('line 4'), ['name the line', four])
        assert(four.includes('INFLATES'), ['and which way a negative line 4 runs', four])
        assertEq(
            [one, two, four].length,
            3,
            'three printed inputs, each guarded — a fourth input needs a fourth case here')

        // ── THE CONTROL, at the boundary ─────────────────────────────────────
        // ZERO is legitimate on every one of the three: a move with nothing
        // shipped, nothing travelled, or nothing reimbursed is an ordinary
        // return. -1 cent refuses, 0 does not.
        assertEq(expectLines(movingExpenses(zero)).line5, 0n, 'all three at zero: computed')
        assertEq(
            expectLines(movingExpenses({ ...zero, transportationAndStorageCents: 1n })).line5,
            1n,
            'one cent of shipping: computed')
    },
    /**
     * `movingExpensesLine4W2Box12Codes` is what a caller's W-2 sweep matches
     * on, so its CONTENTS are a contract. Hand-typed here: a count derived
     * from the exported list could not notice the list changing.
     */
    exactlyOneWTwoBoxTwelveCodeFeedsLineFour: () => {
        assertEq(movingExpensesLine4W2Box12Codes.length, 1,
            "line 4's printed caption names one code")
        assert(movingExpensesLine4W2Box12Codes.includes('P'),
            ['and it is P', movingExpensesLine4W2Box12Codes])
        // The codes that are NOT line 4, hand-typed: D is a 401(k) deferral, W
        // an employer HSA contribution, DD the cost of employer health
        // coverage, A uncollected social security tax on tips. None is a
        // moving reimbursement.
        for (const code of ['A', 'D', 'DD', 'W']) {
            assert(!movingExpensesLine4W2Box12Codes.includes(code),
                [`box 12 code ${code} is not line 4`, movingExpensesLine4W2Box12Codes])
        }
    },
}
