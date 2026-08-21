/**
 * Form 6251 **line 2j** — the alternative minimum tax adjustment a beneficiary
 * receives from an estate or trust, read off Schedule K-1 (Form 1041) **box 12
 * code A**.
 *
 * Sources, fetched and read directly (2026-08-18), not from recall:
 * - `https://www.irs.gov/pub/irs-pdf/f6251.pdf` — the 2025 form. Line 2j's
 *   printed caption is *"Estates and trusts (amount from Schedule K-1 (Form
 *   1041), box 12, code A)"*. The code letter is ON THE FORM'S OWN FACE, which
 *   is why {@link line2jCodes} holds exactly one entry.
 * - `https://www.irs.gov/pub/irs-pdf/i1041sk1.pdf` — *Box 12—Alternative
 *   Minimum Tax Items*: *"The information reported in box 12, codes A through
 *   I, is used to prepare your Form 6251. **Code A, Adjustment for minimum tax
 *   purposes, is the total amount reported on Form 6251, line 2j. Codes B
 *   through F represent the portion, if any, of the amount included in code
 *   A.**"*
 * - `https://www.irs.gov/pub/irs-pdf/i6251.pdf` — *Beneficiaries of estates or
 *   trusts*, a table routing codes B, C, D, E and F into Part III's AMT
 *   worksheets.
 *
 * See `fjs/form6251/todo/estates-and-trusts.md` for the full argument; the
 * three claims that decide this module's shape are here because they decide
 * every line of it.
 *
 * ## Only code A, and the two reasons the other nine stay refused
 *
 * 1. **B through F are a PORTION OF code A**, in the K-1 instructions' own
 *    words. Adding one to line 2j would count the same adjustment twice. What
 *    they are for is refiguring the AMT versions of the capital-gain
 *    worksheets in **Part III** — `fjs/form6251/part3` builds Part III from
 *    the REGULAR tax's worksheet, with no mechanism for a per-K-1
 *    modification, so a return carrying one of them is refused by the sweep in
 *    `fjs/schedule/e` rather than computed with a Part III that quietly
 *    ignored them.
 * 2. **G, H and I go to OTHER Form 6251 lines** — accelerated depreciation to
 *    line 2l, depletion to 2d, amortization to the line the instructions point
 *    at — every one of which is a documented zero with its own live
 *    `fjs/return/scope` kind. Routing them here would produce the right total
 *    on the wrong line, on a form whose Part I lines are read individually by
 *    Form 8801 the following year.
 *
 * Code **J**, exclusion items, is not a Form 6251 item at all: it feeds the
 * 2026 Form 8801 minimum tax credit, which `priorYearMinimumTaxCredit` already
 * refuses by name.
 *
 * ## The sum is NOT floored at zero
 *
 * An AMT adjustment can be negative — an estate whose AMT depreciation now
 * exceeds its regular depreciation reports the difference as a negative code A
 * — and line 2j takes it as reported. The printed page carries no *"if zero or
 * less, enter -0-"* here and no parentheses box (contrast lines 2b and 2f), and
 * `i6251.pdf`'s own *Who Must File* item 4 — *"The total of Form 6251, lines 2c
 * through 3, is negative"* — states that this block of lines may sum below
 * zero. Flooring would OVERSTATE alternative minimum taxable income, which is a
 * confident wrong answer; "overstating is safe" is not a principle this project
 * holds.
 *
 * ## An absent amount REFUSES
 *
 * `codedEntry.amount` is optional because a coded row routinely prints `STMT`
 * when the figure lives on an attached statement. A code A row with no amount
 * is therefore not an adjustment of zero — it is an adjustment this engine has
 * not been given. Skipping it would silently drop a preference item the
 * fiduciary reported to the IRS, so it refuses, exactly as a Form 3921 missing
 * box 3, 4 or 5 refuses at line 2i.
 *
 * ## Why this is its own module
 *
 * `fjs/schedule/e`'s coded sweep must let through EXACTLY the codes this line
 * computes, and `fjs/schedule/2` must cite exactly the entries this line
 * summed. Three call sites, one rule: {@link line2jCodes} is the single
 * hand-typed list all of them read, so the gate cannot open wider than the
 * computation and a citation cannot name a row that did not contribute
 * (AGENTS.md, "one rule, one place").
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'

/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { Source } from '../../report/line/module.f.js' */

/**
 * A stored document as this module sees it — mirrors every other consumer's
 * own `Stored<T>`; nothing here re-validates.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * The graceful, tagged refusal — structurally `Form6251Error`, which
 * `fjs/form6251` threads out verbatim.
 * @typedef {{ readonly kind: 'error', readonly message: string }} EstateTrustAmtError
 */

/** @typedef {{ readonly kind: 'ok', readonly cents: bigint } | EstateTrustAmtError} EstateTrustAmtOutcome */

/**
 * **The box 12 codes Form 6251 line 2j takes: `A`, and only `A`.**
 *
 * Hand-typed from the printed line 2j caption, and typed as `readonly
 * string[]` rather than a `const` tuple so `fjs/schedule/e`'s
 * `estateTrustCodedBoxes` table can hold this very array as its
 * pass-through list. That sharing is the point: the gate and the sum cannot
 * disagree about which codes are routed, because there is one list.
 *
 * A list rather than a bare string because the printed form's own vocabulary
 * is a list — and because the next code this engine learns to compute (G, to
 * line 2l, say) must be added to the GATE and to a computation together, which
 * a one-element list makes obvious and a bare `=== 'A'` would not.
 * @type {readonly string[]}
 */
export const line2jCodes = ['A']

/**
 * A printed code letter, normalized for comparison: trimmed and upper-cased.
 *
 * `fjs/document/k1_1041` stores a coded row's `code` exactly as printed and
 * never interprets it, so the comparison has to. The shape is
 * `employerHsaContributionSources`' (`fjs/schedule/1`), and the WHOLE string is
 * compared — never a prefix. A row coded `'AA'` is not code `A`.
 * @type {(code: string) => string}
 */
const normalizedCode = code => code.trim().toUpperCase()

/**
 * Is this row's code one of {@link line2jCodes}?
 * @type {(code: string) => boolean}
 */
const isLine2jCode = code => line2jCodes.includes(normalizedCode(code))

/**
 * Every box 12 row on every stored Schedule K-1 (Form 1041) whose code reaches
 * line 2j, paired with the document it came from.
 *
 * Private: the two exported readers below are the API, and a caller that
 * walked the rows itself would be a fourth place the code match lives.
 * @type {(forms: readonly Stored<K1EstateTrust>[]) => readonly { readonly documentHash: string, readonly code: string, readonly amount: string | undefined }[]}
 */
const line2jRows = forms => forms.flatMap(form =>
    (form.value.box12AlternativeMinimumTaxItems ?? [])
        .filter(entry => isLine2jCode(entry.code))
        .map(entry => ({
            documentHash: form.documentHash,
            code: normalizedCode(entry.code),
            amount: entry.amount,
        })))

/**
 * **One `Source` per contributing box 12 entry**, never one per document: a
 * single K-1 can carry several coded rows and a per-document citation could not
 * say which row put the figure on line 2j.
 *
 * The box path is **dialect-qualified**, and that is not decoration: `box12`
 * exists on two forms this engine reads and BOTH have a code A — Form W-2 box
 * 12 code A is uncollected social security tax on tips (Schedule 2 line 13),
 * and this is the fiduciary's AMT adjustment. `fjs/form1040/core` qualifies
 * every K-1 box path for the same reason at 1040 line 2b.
 *
 * The NORMALIZED code reaches the path, so a citation reads
 * `k1_1041.box12[code=A]` whatever the stored spelling was.
 *
 * A row with no amount contributes no source, because it cannot contribute a
 * value — {@link estateTrustAmtAdjustment} has already refused the return by
 * the time any caller asks for citations.
 * @type {(forms: readonly Stored<K1EstateTrust>[]) => readonly Source[]}
 */
export const estateTrustAmtAdjustmentSources = forms => line2jRows(forms).flatMap(row =>
    row.amount === undefined
        ? []
        : [{
            documentHash: row.documentHash,
            boxPath: `k1_1041.box12[code=${row.code}]`,
            value: row.amount,
        }])

/**
 * Form 6251 line 2j: the sum of box 12 code A over every stored Schedule K-1
 * (Form 1041), or the refusal a row with no amount forces.
 *
 * Summed across every stored form WITHOUT scoping by `recipientTin`, exactly as
 * line 2i is: a joint return computes ONE Form 6251 over ONE alternative
 * minimum taxable income and §56 makes no per-spouse distinction.
 * @type {(forms: readonly Stored<K1EstateTrust>[]) => EstateTrustAmtOutcome}
 */
export const estateTrustAmtAdjustment = forms => {
    let total = 0n
    for (const row of line2jRows(forms)) {
        const { amount } = row
        if (amount === undefined) {
            return {
                kind: 'error',
                message: `Form 6251 line 2j: Schedule K-1 (Form 1041) ${row.documentHash} carries `
                    + `box 12 code ${row.code} with NO amount — the row a fiduciary prints as `
                    + `'STMT' when the figure is on an attached statement. Line 2j is that figure `
                    + `outright ("amount from Schedule K-1 (Form 1041), box 12, code A"), so `
                    + `there is nothing here to compute from. An absent box is ABSENT, never `
                    + `zero: treating it as zero would silently drop an alternative minimum tax `
                    + `adjustment the fiduciary reported to the IRS, and a positive one would `
                    + `understate the tax. Supply the amount from the statement.`,
            }
        }
        // NOT floored, per printed line and this module's own docstring: a
        // negative code A reduces alternative minimum taxable income.
        total += centsFromString(amount)
    }
    return { kind: 'ok', cents: total }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/** @import { CodedEntry } from '../../document/k1_common/module.f.js' */

/**
 * A stored beneficiary's Schedule K-1 carrying exactly the box 12 rows given.
 * Box 6 is absent: these leaves are about the AMT adjustment, not about
 * Schedule E.
 * @type {(documentHash: string) => (box12: readonly CodedEntry[]) => Stored<K1EstateTrust>}
 */
const k1 = documentHash => box12 => ({
    documentHash,
    value: {
        dialect: 'vnd.fjs.k1_1041',
        estateOrTrustEIN: '66-6666666',
        beneficiaryIdentifyingNumber: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        payerName: 'The Harrow Family Trust',
        boxHDomesticBeneficiary: /** @type {const} */ (true),
        materialParticipation: 'materiallyParticipated',
        box12AlternativeMinimumTaxItems: box12,
    },
})

/**
 * Unwraps an ok outcome, throwing the refusal if there was one.
 * @type {(outcome: EstateTrustAmtOutcome) => bigint}
 */
const expectCents = outcome => {
    assert(outcome.kind === 'ok', ['expected line 2j to compute', outcome])
    if (outcome.kind !== 'ok') {
        throw ['expected line 2j to compute', outcome]
    }
    return outcome.cents
}

/**
 * Unwraps a refusal, throwing the figure if the outcome computed.
 * @type {(outcome: EstateTrustAmtOutcome) => string}
 */
const expectRefusal = outcome => {
    assert(outcome.kind === 'error', ['expected a refusal', outcome])
    if (outcome.kind !== 'error') {
        throw ['expected a refusal', outcome]
    }
    return outcome.message
}

export const proof = {
    /** The printed line, at its simplest: one K-1, one code A row. */
    oneCodeARowIsLineTwoJ: () => {
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-a')([{ code: 'A', amount: '12500.00' }])])),
            1250000n,
            '$12,500.00')
    },
    /** The citation, in its own leaf: the value above is asserted nowhere here. */
    oneCodeARowCitesItsOwnEntry: () => {
        const sources = estateTrustAmtAdjustmentSources(
            [k1('sha256-k1-a')([{ code: 'A', amount: '12500.00' }])])
        assertEq(sources.length, 1, 'one contributing entry, one source')
        const [source] = sources
        assert(source !== undefined, 'expected the source')
        if (source === undefined) {
            return
        }
        assertEq(source.documentHash, 'sha256-k1-a')
        assertEq(source.boxPath, 'k1_1041.box12[code=A]')
        // The RAW printed value, never the summed cents -- the wire
        // representation the dialect itself stores (EXACT-05).
        assertEq(source.value, '12500.00')
    },
    /** Two documents: the total adds, and each cites under its OWN hash. */
    twoBeneficiaryFormsAdd: () => {
        const forms = [
            k1('sha256-k1-a')([{ code: 'A', amount: '12500.00' }]),
            k1('sha256-k1-b')([{ code: 'A', amount: '400.25' }]),
        ]
        assertEq(expectCents(estateTrustAmtAdjustment(forms)), 1290025n, '$12,900.25')
        const hashes = estateTrustAmtAdjustmentSources(forms).map(source => source.documentHash)
        assertEq(hashes.length, 2)
        assert(hashes.includes('sha256-k1-a') && hashes.includes('sha256-k1-b'), hashes)
    },
    /**
     * **A NEGATIVE adjustment is not floored.** An estate whose AMT
     * depreciation now exceeds its regular depreciation reports a negative
     * code A, and line 2j takes it as reported — flooring it at zero would
     * overstate alternative minimum taxable income.
     */
    aNegativeAdjustmentIsNotFloored: () => {
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-neg')([{ code: 'A', amount: '-3000.00' }])])),
            -300000n,
            'minus $3,000.00, unfloored')
        // And two documents of opposite sign NET, which they could not do if
        // either were floored on its own.
        assertEq(
            expectCents(estateTrustAmtAdjustment([
                k1('sha256-k1-pos')([{ code: 'A', amount: '5000.00' }]),
                k1('sha256-k1-neg')([{ code: 'A', amount: '-3000.00' }]),
            ])),
            200000n,
            '$5,000.00 - $3,000.00 = $2,000.00')
    },
    /** The citation of a negative row keeps the printed sign. */
    aNegativeAdjustmentCitesItsPrintedSign: () => {
        const sources = estateTrustAmtAdjustmentSources(
            [k1('sha256-k1-neg')([{ code: 'A', amount: '-3000.00' }])])
        assertEq(sources.length, 1)
        const [source] = sources
        assert(source !== undefined, 'expected the source')
        if (source === undefined) {
            return
        }
        assertEq(source.value, '-3000.00', 'the sign is part of what the box printed')
    },
    /**
     * **The sum's own control.** Every other box 12 code is a portion of code A
     * (B-F), belongs on another Form 6251 line (G-I), or belongs on next year's
     * Form 8801 (J) — so none of them adds a cent here. The nine codes are
     * HAND-TYPED, never derived from `line2jCodes`, so adding one to the routed
     * list reddens this leaf.
     *
     * The return-level control is the gate in `fjs/schedule/e`, which refuses
     * each of these outright; this leaf is the arithmetic half of the same
     * claim.
     */
    noOtherBoxTwelveCodeReachesLineTwoJ: () => {
        /** @type {readonly string[]} */
        const refusedCodes = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']
        assertEq(refusedCodes.length, 9, 'box 12 prints ten codes and exactly one of them is line 2j')
        for (const code of refusedCodes) {
            assertEq(
                expectCents(estateTrustAmtAdjustment([k1('sha256-k1-other')([{ code, amount: '900.00' }])])),
                0n,
                `box 12 code ${code} is not line 2j`)
            assertEq(
                estateTrustAmtAdjustmentSources([k1('sha256-k1-other')([{ code, amount: '900.00' }])]).length,
                0,
                `and cites nothing: ${code}`)
        }
        // The CONTROL for the control: the same document with code A added
        // computes, so this is not a reader that returns zero for everything.
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-mixed')([
                { code: 'B', amount: '900.00' },
                { code: 'A', amount: '100.00' },
                { code: 'J', amount: '900.00' },
            ])])),
            10000n,
            'only code A contributes, $100.00')
    },
    /**
     * Case and whitespace are the same box; `'AA'` is a DIFFERENT one. The
     * second half is what a prefix match would get wrong, and no printed box 12
     * code is two letters — which is precisely why a loosened match would
     * otherwise be unobservable.
     */
    theCodeIsMatchedTrimmedUpperCasedAndWhole: () => {
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-lower')([{ code: ' a ', amount: '700.00' }])])),
            70000n,
            "' a ' is the same box as 'A'")
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-aa')([{ code: 'AA', amount: '700.00' }])])),
            0n,
            "'AA' is not code 'A'")
        assertEq(
            estateTrustAmtAdjustmentSources([k1('sha256-k1-aa')([{ code: 'AA', amount: '700.00' }])]).length,
            0,
            "and 'AA' cites nothing")
        // The normalized code reaches the citation, so provenance reads the
        // same whatever the transcriber typed.
        const [source] = estateTrustAmtAdjustmentSources(
            [k1('sha256-k1-lower')([{ code: ' a ', amount: '700.00' }])])
        assert(source !== undefined, 'expected the source')
        if (source === undefined) {
            return
        }
        assertEq(source.boxPath, 'k1_1041.box12[code=A]')
    },
    /** No box 12 at all, an empty box 12, and no documents: a clean zero. */
    anAbsentBoxIsZeroAndCitesNothing: () => {
        assertEq(expectCents(estateTrustAmtAdjustment([])), 0n, 'no documents')
        assertEq(expectCents(estateTrustAmtAdjustment([k1('sha256-k1-empty')([])])), 0n, 'an empty box 12')
        assertEq(estateTrustAmtAdjustmentSources([k1('sha256-k1-empty')([])]).length, 0)
        // A K-1 with no `box12` key at all -- the key ABSENT, not present and
        // undefined, which are the two states DOC-11 keeps apart.
        /** @type {Stored<K1EstateTrust>} */
        const noBoxTwelve = {
            documentHash: 'sha256-k1-none',
            value: {
                dialect: 'vnd.fjs.k1_1041',
                estateOrTrustEIN: '66-6666666',
                beneficiaryIdentifyingNumber: '222-22-2222',
                taxYear: 2025,
                formRevision: '2025',
                boxHDomesticBeneficiary: true,
                materialParticipation: 'materiallyParticipated',
            },
        }
        assertEq(expectCents(estateTrustAmtAdjustment([noBoxTwelve])), 0n, 'no box 12 key at all')
        assertEq(estateTrustAmtAdjustmentSources([noBoxTwelve]).length, 0)
    },
    /**
     * A code A row printed as `STMT` — no amount — REFUSES. The message names
     * the document and says what to supply, because that is the only part of it
     * a reader can act on.
     */
    aCodeARowWithNoAmountRefuses: () => {
        const message = expectRefusal(
            estateTrustAmtAdjustment([k1('sha256-k1-stmt')([{ code: 'A' }])]))
        assert(message.includes('sha256-k1-stmt'), ['name the document', message])
        assert(message.includes('box 12 code A'), ['name the box and the code', message])
        assert(message.includes('line 2j'), ['name the line', message])
        assert(message.includes('STMT'), ['name what the row prints instead', message])
        assert(message.includes('understate'), ['say which way the error runs', message])
        // The CONTROL: a row with no amount under a code line 2j does NOT
        // route is not this module's business -- `fjs/schedule/e`'s sweep
        // handles it -- so it must not refuse here.
        assertEq(
            expectCents(estateTrustAmtAdjustment([k1('sha256-k1-stmt-g')([{ code: 'G' }])])),
            0n,
            'a code this line does not route is not this refusal')
    },
    /**
     * `line2jCodes` is what `fjs/schedule/e`'s gate opens for, so its CONTENTS
     * are a contract and not an implementation detail. Hand-typed, per
     * AGENTS.md: a list derived from the code under test cannot notice itself
     * changing.
     */
    exactlyOneCodeIsRouted: () => {
        assertEq(line2jCodes.length, 1, 'the printed caption names one code')
        assert(line2jCodes.includes('A'), ['and it is A', line2jCodes])
    },
}
