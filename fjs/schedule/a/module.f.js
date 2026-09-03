/**
 * Schedule A (Form 1040) — TAX-13: all 18 printed lines across all six
 * sections (Medical and Dental Expenses, Taxes You Paid, Interest You Paid,
 * Gifts to Charity, Casualty and Theft Losses, Other Itemized Deductions),
 * the State and Local Tax Deduction Worksheet (line 5e), and the 7.5%
 * medical floor (line 3).
 *
 * Source, transcribed directly (13-RESEARCH.md §3), not from recall:
 * `f1040sa.pdf` (2025), both pages, "Created 11/20/25"; `i1040sca.pdf`, both
 * pages.
 *
 * This is a STANDALONE, independently callable pure function over stored
 * `vnd.fjs.itemized_deductions`/`vnd.fjs.medical_expenses` entries, the
 * declared return profile, and the stored W-2/1099-R documents Decision
 * 2.2's withholding-drift check reads (WR-02) — the same relationship
 * `fjs/schedule/b` and `fjs/schedule/1a` have to their own inputs. It is NOT
 * wired into Form 1040's own line 12e or `deductionChoice` (both 13-07's
 * job), and it does not consult the return-scope guard's own classification
 * function. It imports NOTHING at runtime from `fjs/tax/deduction`,
 * `fjs/return/scope`, or `fjs/form1040/`.
 *
 * ## Two DIFFERENT kinds of "boundary" on this schedule — do not conflate them
 *
 * - **Documented zeros (line 9, line 15).** No source populates Form 4952
 *   (investment interest expense, line 9) or Form 4684 (casualty/theft
 *   losses, line 15) — neither form exists in this codebase. Both are
 *   `profileDeclaredZeroLine`s citing `profile.value.declaredKinds`,
 *   mirroring `fjs/schedule/b`'s own Form 8815 treatment exactly. Line 9's
 *   zero is safe precisely BECAUSE a taxpayer who declares the
 *   `investmentInterestForm4952` kind refuses the WHOLE return at the scope
 *   layer (`fjs/return/scope`, not built here) — this module never has to
 *   decide that; it only has to be correct for every return the engine can
 *   otherwise compute, where the kind is undeclared and the true amount is
 *   genuinely zero.
 * - **Trusted, already-limited taxpayer assertions (lines 8a-8c, 11-14).**
 *   The mortgage-interest acquisition-debt caps (Pub. 936, $750,000/
 *   $375,000 MFS post-12/15/2017 debt) and the charitable AGI-percentage
 *   limits (Pub. 526, 30%/20% of AGI) are NOT computed anywhere on Schedule
 *   A's own printed face — 13-RESEARCH.md §3 confirms both limitations are
 *   deferred entirely to their own publications, with pure addition on the
 *   form itself. Per Decision 2.1, `vnd.fjs.itemized_deductions` entries
 *   tagged `mortgageInterest1098`/`mortgageInterestNo1098`/`pointsNo1098`/
 *   `charitableCash`/`charitableNonCash`/`charitableCarryover` are trusted
 *   as ALREADY Pub-936/Pub-526-limited by the taxpayer. This is not a zero
 *   and not a refusal — it is a face-value read, exactly like every other
 *   itemized entry, and it is the correct behavior BECAUSE the printed form
 *   itself performs no limitation arithmetic here.
 *
 * ## The SALT worksheet's "flat-then-halved" quirk — two independent facts,
 * never one combined rule
 *
 * The printed State and Local Tax Deduction Worksheet uses the FLAT,
 * non-MFS dollar figures on every line EXCEPT the final one:
 * - w1 (the $40,000 cap) and w9 (the $10,000 floor) are the SAME flat
 *   figures for every filing status, MFS included.
 * - w5 (the phase-down's own income threshold, $500,000/$250,000 MFS) IS
 *   genuinely status-specific on the worksheet's own face — this is a
 *   DIFFERENT fact from w1/w9's flatness, not a contradiction of it.
 * - w10 ALONE halves the computed result for MFS filers, and only after
 *   w9 has already been computed from the flat, non-halved figures.
 *
 * Halving w1 or w9 for an MFS filer (13-RESEARCH.md Pitfall 2) produces a
 * wrong number that looks entirely reasonable — `saltCapWorksheet` below
 * computes w1/w9 identically regardless of filing status, and applies the
 * ONE halving step to w9 only when constructing w10, immediately before the
 * final `smaller-of` comparison against line 5d. {@link proof}'s
 * `saltWorksheet.mfsHalvesOnlyTheFinalLine` fixture is this module's own
 * hand-written pin of that exact arithmetic (13-RESEARCH.md §3, `w1`
 * through `w10`).
 *
 * ## A THIRD kind of boundary: data-sufficiency refusals (CR-01, WR-04)
 *
 * Distinct from both of the above: a stored document that is structurally
 * valid but semantically UNREPRESENTABLE on the printed form. Line 5a is a
 * single EITHER/OR election (state/local income tax paid, OR general sales
 * tax, never both — the printed form's own line 5a checkbox,
 * 13-RESEARCH.md §3) — a document carrying entries under BOTH
 * `saltIncomeTax` and `saltGeneralSalesTax` cannot be summed into one
 * honest figure. Likewise, an `entries[].lineTag` outside the eleven this
 * module actually reads (13-CONTEXT.md Decision 2.1 keeps `lineTag` a free
 * string at the DIALECT boundary; the recognized set is known only HERE,
 * at the schedule that consumes it) is a typo or a stale tag, not a
 * legitimate zero. A THIRD case (WR-02): the income-tax election's own
 * asserted amount drifting BELOW the state/local income tax already
 * withheld on stored W-2s/1099-Rs (Decision 2.2's own withholding-drift
 * check, now wired into this module's real computation — see "Decision
 * 2.2's withholding-drift check" below). All three refuse via
 * `{ kind: 'error' }` — the SAME shape `fjs/schedule/d`/`fjs/form8812`
 * already use for their own document-data-sufficiency refusals (12.1
 * Decision 2.6's category), never a `fjs/return/scope` kind (this is not a
 * declared-but-unmodeled-kind problem) and never a silent sum or a silent
 * drop.
 *
 * ## Neither TY2026 OBBBA itemized-deduction change is implemented
 * (Decision 5.8)
 *
 * The 0.5%-of-AGI charitable floor and the high-income "2/37ths" haircut
 * are confirmed TY2026-effective by the 2025 instructions' own "What's
 * New" (13-RESEARCH.md §3) — NEITHER appears anywhere in this module.
 * `proof.obbbaTy2026ChangesNotImplemented` is this module's own negative
 * pin: a large charitable gift at a high AGI still deducts in full,
 * unreduced by either change.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { of, multiply, halfUp } from '../../types/rational/module.f.js'
import { centsFromString } from '../../exact/module.f.js'
import { taxParamsByYear } from '../../tax/params/module.f.js'
import { refuses } from '../../refuses/module.f.js'

/** @import { TaxParamSet, IndividualFilingStatus } from '../../tax/params/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */
/** @import { W2 } from '../../document/w2/module.f.js' */
/** @import { OneZeroNineNineR } from '../../document/1099r/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document (or a flattened entry from one) as this module sees
 * it: the CAS hash it is addressed by, paired with its ALREADY-VALIDATED
 * value. Nothing here re-validates — mirrors `fjs/schedule/b`'s own
 * `Stored<T>`.
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * One `vnd.fjs.itemized_deductions` entry, as this module sees it — mirrors
 * that dialect's own `entries` element shape (`fjs/document/itemized_deductions`
 * exports no per-entry type of its own to import).
 * @typedef {{ readonly lineTag: string, readonly provider: string, readonly amount: string }} ItemizedEntry
 */

/**
 * One `vnd.fjs.medical_expenses` entry, as this module sees it — mirrors
 * that dialect's own `entries` element shape.
 * @typedef {{
 *   readonly datePaid: string, readonly provider: string, readonly category: string,
 *   readonly amount: string, readonly reimbursed?: string,
 * }} MedicalExpenseEntry
 */

/**
 * Everything Schedule A reads: the filing status and AGI a caller has
 * already computed, the itemized-deductions entries flattened from the ONE
 * stored `vnd.fjs.itemized_deductions` document (each entry paired with
 * that document's own hash), the medical-expense entries flattened from the
 * ONE stored `vnd.fjs.medical_expenses` document the same way, the one
 * return profile a return has exactly one of, and the STORED W-2/1099-R
 * documents Decision 2.2's withholding-drift check reads (WR-02,
 * 13-REVIEW.md — see this module's own docstring, "Decision 2.2's
 * withholding-drift check"). The two document arrays are OPTIONAL
 * (`?? []` inside {@link scheduleA}): a caller/fixture that supplies
 * neither exercises every line exactly as before WR-02 landed, since the
 * drift check is a no-op with no documents to compare against.
 * @typedef {{
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly itemizedEntries: readonly Stored<ItemizedEntry>[],
 *   readonly medicalExpenseEntries: readonly Stored<MedicalExpenseEntry>[],
 *   readonly profile: Stored<ReturnProfile>,
 *   readonly form2555Line45Cents: bigint,
 *   readonly w2Forms?: readonly Stored<W2>[],
 *   readonly oneZeroNineNineRForms?: readonly Stored<OneZeroNineNineR>[],
 * }} ScheduleAInput
 */

// ── Local helpers (reimplemented, not imported from `fjs/form1040/core`) ──────

/**
 * The exact cents sum of a set of {@link Source}s, with one `Source` per
 * PRESENT entry. `sources` is a PLAIN, possibly-empty array — deliberately
 * not a `ReportLine`; {@link documentLine} is where an empty sum becomes a
 * profile-declared zero instead. Mirrors `fjs/schedule/b`'s own `BoxSum`.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

/**
 * The exact cents sum of every itemized-deductions entry carrying ONE
 * `lineTag`, across a flattened list of stored entries — the
 * itemized-deductions analog of `fjs/schedule/b`'s `sumBoxOverDocuments`,
 * filtering by `lineTag` instead of reading one fixed box name (this
 * dialect has no fixed box layout at all — see
 * `fjs/document/itemized_deductions`'s own docstring). Each emitted
 * {@link Source}'s `boxPath` names the filter, `entries[lineTag=<lineTag>]`,
 * rather than a printed box.
 * @type {(entries: readonly Stored<ItemizedEntry>[]) => (lineTag: string) => BoxSum}
 */
const sumEntriesByLineTag = entries => lineTag => {
    const sources = entries
        .filter(entry => entry.value.lineTag === lineTag)
        .map(entry => ({
            documentHash: entry.documentHash,
            boxPath: `entries[lineTag=${lineTag}]`,
            value: entry.value.amount,
        }))
    return {
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

/**
 * Every `lineTag` this module's own `byTag(...)` calls (via
 * {@link sumEntriesByLineTag}) recognize — the ONLY vocabulary Schedule A
 * can place a dollar figure against. Hand-typed as a single list (not
 * derived from the `byTag('...')` call sites below, which would make this
 * list a function of the code it is meant to police) so a future retagging
 * touches exactly one place. {@link firstUnrecognizedLineTag} refuses any
 * stored entry carrying anything outside it (WR-04, 13-REVIEW.md) — Decision
 * 2.1 keeps `lineTag` a free string at the DIALECT boundary
 * (`fjs/document/itemized_deductions`); this is the SCHEDULE A boundary
 * where the recognized set is actually known.
 * @type {readonly string[]}
 */
const knownLineTags = [
    'saltIncomeTax', 'saltGeneralSalesTax', 'realEstateTax', 'personalPropertyTax',
    'otherTaxes', 'mortgageInterest1098', 'mortgageInterestNo1098', 'pointsNo1098',
    'charitableCash', 'charitableNonCash', 'charitableCarryover', 'otherItemized',
]

/**
 * The exact count of {@link knownLineTags} — an independently hand-typed
 * expectation, AGENTS.md's `expectedThresholdCount` idiom, so deleting an
 * entry from the list above fails a proof even though `.length` would
 * otherwise happily report one fewer without complaint.
 * @type {number}
 */
const expectedKnownLineTagCount = 12

/**
 * The FIRST stored entry whose `lineTag` is not in {@link knownLineTags},
 * or `undefined` if every entry's tag is recognized.
 * @type {(entries: readonly Stored<ItemizedEntry>[]) => string | undefined}
 */
const firstUnrecognizedLineTag = entries => {
    const unrecognized = entries.find(entry => !knownLineTags.includes(entry.value.lineTag))
    return unrecognized?.value.lineTag
}

/**
 * The exact cents sum of every stored medical/dental expense entry, NET of
 * its own `reimbursed` amount — an entry-level subtraction, not a single
 * printed box read, so it is written once here rather than forced through
 * {@link sumEntriesByLineTag} (which sums raw amounts only, with no
 * per-entry adjustment). DOC-11 still holds at the entry level: an absent
 * `reimbursed` contributes nothing to the subtraction.
 * @type {(entries: readonly Stored<MedicalExpenseEntry>[]) => BoxSum}
 */
const sumMedicalEntriesNetOfReimbursement = entries => {
    const sources = entries.map(entry => ({
        documentHash: entry.documentHash,
        boxPath: 'entries[category=medical].amount',
        value: entry.value.amount,
    }))
    const value = entries.reduce((total, entry) => {
        const grossCents = centsFromString(entry.value.amount)
        const reimbursedCents = entry.value.reimbursed === undefined
            ? 0n
            : centsFromString(entry.value.reimbursed)
        return total + (grossCents - reimbursedCents)
    }, 0n)
    return { value, sources }
}

/**
 * Adds two {@link BoxSum}s — mirrors `fjs/schedule/b`'s own `addBoxSums`.
 * Used for line 5a, which reads EITHER the `saltIncomeTax`-tagged entry or
 * the `saltGeneralSalesTax`-tagged entry (a taxpayer elects one, never
 * both) — summing across both tags collapses to "whichever one is present"
 * WITHOUT an explicit branch ONLY because {@link scheduleA} itself refuses
 * (CR-01, `{ kind: 'error' }`) before ever calling this on line 5a's two
 * sums, when BOTH tags are present. `addBoxSums` here is never handed two
 * genuinely populated sums at once — see `scheduleA`'s own mutual-exclusion
 * check, immediately before its line 5a is built.
 * @type {(a: BoxSum) => (b: BoxSum) => BoxSum}
 */
const addBoxSums = a => b => ({
    value: a.value + b.value,
    sources: [...a.sources, ...b.sources],
})

/**
 * A line that is zero because the taxpayer declared no such income/expense,
 * citing the return profile's own `declaredKinds` box as its provenance —
 * mirrors `fjs/schedule/b`'s own `profileDeclaredZeroLine`, reimplemented
 * locally (private; not imported from `fjs/form1040/core`, which does not
 * export it).
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
 * A line whose value came from stored entries — falling back to
 * {@link profileDeclaredZeroLine} when NO entry supplied a reading. Mirrors
 * `fjs/schedule/b`'s own `documentLine`.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (sum: BoxSum) => ReportLine}
 */
const documentLine = profile => rule => sum => {
    const [first, ...rest] = sum.sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value: sum.value, sources: [first, ...rest], rule }
}

/**
 * `cents * ratePercent / 100`, rounded to the nearest cent (IRS half-up,
 * ties away from zero) — reimplemented locally rather than reused from
 * `fjs/schedule/1a`'s own private `percentOfCents`, which only accepts a
 * whole-number `bigint` rate. Both `medicalExpenseFloor.ratePercent` (7.5)
 * and `saltCap.phasedownRatePercent` (30) are plain `number`s per
 * `fjs/tax/params`, and 7.5 is not a whole number `BigInt` can accept.
 * `ratePercent * 10` is exact for both rates this project stores today (at
 * most one decimal digit), so the rational built from it —
 * `(ratePercent x 10) / 1000` — is exact, never a floating-point division.
 * @type {(cents: bigint) => (ratePercent: number) => bigint}
 */
const centsAtRatePercent = cents => ratePercent =>
    halfUp(multiply(of(cents)(1n))(of(BigInt(Math.round(ratePercent * 10)))(1000n)))

// ── The SALT cap phase-down's own named income function (Decision 5.6) ────────

/**
 * TAX-15's named income function for the SALT cap phase-down (13-CONTEXT.md
 * Decision 5.6) — the State and Local Tax Deduction Worksheet's own line w4,
 * "AGI plus w3a through w3e." Its own add-back list, per 13-RESEARCH.md
 * §3's transcription, every term currently zero and unmodeled in this
 * engine:
 * - Puerto Rico excluded income (w3a) — not modeled, always 0.
 * - Form 2555 line 45, foreign earned income exclusion (w3b) — **LIVE as of
 *   TAX-42**, and the first of these four to stop being a documented zero.
 * - Form 2555 line 50, foreign housing exclusion (w3c) — still zero:
 *   `foreignHousingExclusionOrDeduction` is a refused kind.
 * - Form 4563 line 15, American Samoa income exclusion (w3d) — not
 *   modeled, always 0.
 *
 * Deliberately does NOT import or call `fjs/schedule/1a`'s
 * `seniorDeductionPhaseoutIncome`, or any other of TAX-15's income
 * functions, even though every one currently equals bare AGI —
 * 13-PATTERNS.md's `qssParametersEqualMfjAndAreStoredIndependently`
 * precedent: identical values, stored independently, because the
 * coincidence is contingent on what remains unmodeled today, not on the
 * underlying rules being the same rule.
 * @type {(agiCents: bigint) => (form2555Line45Cents: bigint) => bigint}
 */
export const saltCapPhasedownIncome = agiCents => form2555Line45Cents => {
    // Add-backs, per this function's own docstring above. Three are still zero
    // and NAMED rather than omitted.
    const puertoRicoExcludedIncome = 0n
    const form2555Line45ForeignEarnedIncomeExclusion = form2555Line45Cents
    const form2555Line50ForeignHousingExclusion = 0n
    const form4563Line15AmericanSamoaExclusion = 0n
    return agiCents
        + puertoRicoExcludedIncome
        + form2555Line45ForeignEarnedIncomeExclusion
        + form2555Line50ForeignHousingExclusion
        + form4563Line15AmericanSamoaExclusion
}

// ── The State and Local Tax Deduction Worksheet (line 5e) ─────────────────────

/**
 * @typedef {{
 *   readonly w1: bigint, readonly w4: bigint, readonly w5: bigint, readonly w6: bigint,
 *   readonly w7: bigint, readonly w8: bigint, readonly w9: bigint, readonly w10: bigint,
 * }} SaltWorksheetResult
 */

/**
 * The State and Local Tax Deduction Worksheet, transcribed line-for-line
 * from 13-RESEARCH.md §3. w2 (bare AGI) and w3a-w3e (the always-zero
 * add-backs) are folded into {@link saltCapPhasedownIncome}'s own `w4`
 * output rather than carried as five always-trivial intermediate fields.
 *
 * See this module's own docstring, "The SALT worksheet's 'flat-then-halved'
 * quirk", for why w1/w9 stay flat while only w10 halves for MFS.
 * @type {(taxParamSet: TaxParamSet) => (input: {
 *   readonly status: IndividualFilingStatus,
 *   readonly agiCents: bigint,
 *   readonly line5dCents: bigint,
 *   readonly form2555Line45Cents: bigint,
 * }) => SaltWorksheetResult}
 */
const saltCapWorksheet = taxParamSet => input => {
    const { status, agiCents, line5dCents, form2555Line45Cents } = input
    const { saltCap } = taxParamSet
    // w1. The flat $40,000 cap -- NOT halved for MFS here (Pitfall 2).
    const w1 = centsFromString(saltCap.flatCap.amount)
    // w2/w3a-w3e folded into w4 -- see this function's own docstring.
    const w4 = saltCapPhasedownIncome(agiCents)(form2555Line45Cents)
    // w5. The worksheet's OWN status-specific threshold -- $250,000 MFS,
    // $500,000 every other status. Unlike w1/w9, this line genuinely IS
    // status-specific on the worksheet's own printed face.
    const w5 = centsFromString(saltCap.threshold[status].amount)
    // w6. "If w4 <= w5: SKIP w7/w8, w9 = w1 (uncapped)." ELSE: w4 - w5.
    const belowThreshold = w4 <= w5
    const w6 = belowThreshold ? 0n : w4 - w5
    // w7. w6 x 30%, CONTINUOUS -- no $1,000 stepping.
    const w7 = belowThreshold ? 0n : centsAtRatePercent(w6)(saltCap.phasedownRatePercent)
    // w8. w1 - w7.
    const w8 = belowThreshold ? 0n : w1 - w7
    // w9. "Larger of w8 or $10,000" -- flat, NOT halved for MFS here.
    const floorCents = centsFromString(saltCap.floor.amount)
    const w9 = belowThreshold ? w1 : (w8 > floorCents ? w8 : floorCents)
    // w10. Smaller of w9 (HALF of w9 IF MFS -- the ONLY line that halves,
    // and only here, after w9 is already fixed) or Schedule A line 5d.
    const w9ForFilingStatus = status === 'marriedFilingSeparately' ? halfUp(of(w9)(2n)) : w9
    const w10 = w9ForFilingStatus < line5dCents ? w9ForFilingStatus : line5dCents
    return { w1, w4, w5, w6, w7, w8, w9, w10 }
}

// ── Decision 2.2's withholding-drift check (WR-02, 13-REVIEW.md) ──────────
//
// WIRED into `scheduleA`'s own real computation below, not merely this
// module's own proof fixtures — `grep`'s single-caller-site finding
// (13-REVIEW.md WR-02) no longer holds: `scheduleA` itself is a second,
// production caller.

/**
 * Decision 2.2's own withholding-drift check. Asserts (throws on failure)
 * that the taxpayer-asserted `saltIncomeTax`-tagged itemized entries sum to
 * AT LEAST the state/local income tax already withheld and reported on
 * stored W-2s/1099-Rs — withheld tax is necessarily paid, so the asserted
 * amount can never honestly be less.
 *
 * Applies ONLY when the income-tax election is in force: if no
 * `saltIncomeTax`-tagged entry is present (the taxpayer instead elected the
 * general-sales-tax line, or asserted nothing at all on line 5a), there is
 * nothing to compare, and this is a silent no-op — never a refusal for a
 * return that legitimately elected the sales-tax line.
 *
 * **The rule lives in {@link saltIncomeTaxDriftMessage}, which RETURNS the
 * refusal instead of throwing it, and this function is the two-line
 * assertion wrapper over it.** It used to be the other way round: the check
 * threw, and `scheduleA` wrapped its one production call in a `try` to turn
 * the bare thrown value back into `{ kind: 'error' }` — a `try` in a `.f.js`,
 * which AGENTS.md forbids, defended by `fjs/exec`'s precedent at a time when
 * `fjs/exec` genuinely had one. `fjs/exec`'s is gone (0.46.0 made a runner's
 * refusal a value), and this one is gone for the more ordinary reason that
 * a refusal a caller must handle was never a panic to begin with. The
 * throwing spelling stays because this module's proofs exercise it through
 * {@link refuses}, and because the two spellings are one rule with one
 * definition — not two checks that can drift.
 *
 * `fjs/document/w2`'s `stateIncomeTax` (inside `box15Through20`) and
 * `fjs/document/1099r`'s `stateTaxWithheld` (inside `stateLocal`) — see both
 * modules' own amended docstrings, which now state this check reads these
 * fields, from `scheduleA`'s real computation, not merely from a proof.
 * Reading them still never FEEDS them into any computed line — line 5a stays
 * taxpayer-asserted, never derived from either box; this check only GATES a
 * refusal.
 * @type {(itemizedEntries: readonly Stored<ItemizedEntry>[]) => (w2Forms: readonly Stored<W2>[]) => (oneZeroNineNineRForms: readonly Stored<OneZeroNineNineR>[]) => string | null}
 */
const saltIncomeTaxDriftMessage = itemizedEntries => w2Forms => oneZeroNineNineRForms => {
    const incomeTaxEntries = itemizedEntries.filter(entry => entry.value.lineTag === 'saltIncomeTax')
    if (incomeTaxEntries.length === 0) {
        // The general-sales-tax election is in force (or nothing at all is
        // asserted on line 5a) -- this check watches the income-tax
        // election only.
        return null
    }
    const assertedCents = incomeTaxEntries.reduce(
        (total, entry) => total + centsFromString(entry.value.amount), 0n)
    const w2WithholdingCents = w2Forms.reduce((total, form) =>
        total + (form.value.box15Through20 ?? []).reduce((rowTotal, row) =>
            rowTotal + (row.stateIncomeTax === undefined ? 0n : centsFromString(row.stateIncomeTax)), 0n),
        0n)
    const oneZeroNineNineRWithholdingCents = oneZeroNineNineRForms.reduce((total, form) =>
        total + (form.value.stateLocal ?? []).reduce((rowTotal, row) =>
            rowTotal + (row.stateTaxWithheld === undefined ? 0n : centsFromString(row.stateTaxWithheld)), 0n),
        0n)
    const storedWithholdingCents = w2WithholdingCents + oneZeroNineNineRWithholdingCents
    if (assertedCents >= storedWithholdingCents) { return null }
    // Assembled here rather than left as the array the `assert` used to
    // throw, and spaced to join identically: the old thrown value was
    // `[sentence, 'asserted', a, 'storedWithholding', b]` and both readers
    // rendered it with `.join(' ')`, so this string is the same text every
    // proof already asserts substrings of.
    return 'Schedule A line 5a (SALT income tax, taxpayer-asserted) is below the state/local '
        + 'income tax already withheld and reported on stored W-2s/1099-Rs -- withheld tax '
        + `is necessarily paid asserted ${assertedCents} storedWithholding ${storedWithholdingCents}`
}

/**
 * {@link saltIncomeTaxDriftMessage} as an assertion — the spelling this
 * module's own proofs exercise through {@link refuses}, and the only reason
 * the throwing form still exists.
 * @type {(itemizedEntries: readonly Stored<ItemizedEntry>[]) => (w2Forms: readonly Stored<W2>[]) => (oneZeroNineNineRForms: readonly Stored<OneZeroNineNineR>[]) => void}
 */
const assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding = itemizedEntries => w2Forms => oneZeroNineNineRForms => {
    const message = saltIncomeTaxDriftMessage(itemizedEntries)(w2Forms)(oneZeroNineNineRForms)
    assert(message === null, message)
}

// ── Schedule A itself ───────────────────────────────────────────────────────

/**
 * All 18 printed lines. Money-carrying lines that read a document/entry
 * (or are a documented zero) are {@link ReportLine}s; lines that are pure
 * arithmetic over already-computed values (with no provenance of their
 * own beyond what their addends already carry) are bare `bigint`s — the
 * same mixed convention `fjs/schedule/1a`'s own `SchedulePartVIResult`
 * already uses (`line13`/`line21`/`line30` are `ReportLine`, `line37`/
 * `line38` are bare `bigint`). `line18` is the boolean election, never
 * money.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly line1: ReportLine, readonly line2: bigint, readonly line3: bigint, readonly line4: bigint,
 *   readonly line5a: ReportLine, readonly line5b: ReportLine, readonly line5c: ReportLine,
 *   readonly line5d: bigint, readonly line5e: bigint,
 *   readonly line6: ReportLine, readonly line7: bigint,
 *   readonly line8a: ReportLine, readonly line8b: ReportLine, readonly line8c: ReportLine,
 *   readonly line8e: bigint,
 *   readonly line9: ReportLine, readonly line10: bigint,
 *   readonly line11: ReportLine, readonly line12: ReportLine, readonly line13: ReportLine,
 *   readonly line14: bigint,
 *   readonly line15: ReportLine, readonly line16: ReportLine, readonly line17: bigint,
 *   readonly line18: boolean,
 *   readonly saltWorksheet: SaltWorksheetResult,
 * }} ScheduleAOk
 */

/**
 * The graceful, tagged refusal a document-data-sufficiency problem produces
 * (this module's own docstring, "A THIRD kind of boundary") — the SAME
 * shape `fjs/schedule/d`'s `ScheduleDError` and `fjs/form8812`'s error arm
 * already use, never a `fjs/return/scope` kind.
 * @typedef {{ readonly kind: 'error', readonly message: string }} ScheduleAError
 */

/** @typedef {ScheduleAOk | ScheduleAError} ScheduleAOutcome */

/**
 * Computes Schedule A for one return.
 * @type {(taxParamSet: TaxParamSet) => (input: ScheduleAInput) => ScheduleAOutcome}
 */
export const scheduleA = taxParamSet => input => {
    const {
        status, agiCents, itemizedEntries, medicalExpenseEntries, profile,
        form2555Line45Cents,
    } = input
    const w2Forms = input.w2Forms ?? []
    const oneZeroNineNineRForms = input.oneZeroNineNineRForms ?? []

    // WR-04 (13-REVIEW.md): an unrecognized `lineTag` must refuse LOUDLY,
    // before any line is built -- never silently drop money from line 17's
    // total. Checked FIRST, ahead of every other computation.
    const unrecognizedTag = firstUnrecognizedLineTag(itemizedEntries)
    if (unrecognizedTag !== undefined) {
        return {
            kind: 'error',
            message: `Schedule A: itemized-deductions entry carries an unrecognized lineTag `
                + `"${unrecognizedTag}" -- known tags: ${knownLineTags.join(', ')}`,
        }
    }

    const fromEntries = documentLine(profile)
    const zero = profileDeclaredZeroLine(profile)
    const byTag = sumEntriesByLineTag(itemizedEntries)

    // ── Medical and Dental Expenses ──────────────────────────────────────
    const line1 = fromEntries('Schedule A line 1')(sumMedicalEntriesNetOfReimbursement(medicalExpenseEntries))
    const line2 = agiCents
    const line3 = centsAtRatePercent(line2)(taxParamSet.medicalExpenseFloor.ratePercent)
    const line4 = line1.value > line3 ? line1.value - line3 : 0n

    // ── Taxes You Paid ────────────────────────────────────────────────────
    // CR-01 (13-REVIEW.md): the printed line 5a is a single EITHER/OR
    // election -- state/local income tax paid, OR general sales tax, NEVER
    // both (13-RESEARCH.md §3, the form's own line 5a checkbox). A document
    // carrying entries under BOTH tags is unrepresentable on the printed
    // form; refuse rather than silently sum both into an inflated figure.
    const saltIncomeTaxSum = byTag('saltIncomeTax')
    const saltGeneralSalesTaxSum = byTag('saltGeneralSalesTax')
    if (saltIncomeTaxSum.sources.length > 0 && saltGeneralSalesTaxSum.sources.length > 0) {
        return {
            kind: 'error',
            message: 'Schedule A line 5a: saltIncomeTax and saltGeneralSalesTax are mutually '
                + 'exclusive elections -- a stored document may not carry entries under both tags',
        }
    }
    const line5a = fromEntries('Schedule A line 5a')(addBoxSums(saltIncomeTaxSum)(saltGeneralSalesTaxSum))
    // WR-02 (13-REVIEW.md): Decision 2.2's withholding-drift check, WIRED
    // into this real computation path (previously exercised only by its own
    // hand-written proof fixtures). It READS the refusal rather than
    // catching it -- the SAME data-sufficiency refusal category as
    // CR-01/WR-04 above, never a `fjs/return/scope` kind, and no longer a
    // `try` in a `.f.js`.
    const driftMessage = saltIncomeTaxDriftMessage(itemizedEntries)(w2Forms)(oneZeroNineNineRForms)
    if (driftMessage !== null) {
        return { kind: 'error', message: driftMessage }
    }
    const line5b = fromEntries('Schedule A line 5b')(byTag('realEstateTax'))
    const line5c = fromEntries('Schedule A line 5c')(byTag('personalPropertyTax'))
    const line5d = line5a.value + line5b.value + line5c.value
    const saltWorksheet = saltCapWorksheet(taxParamSet)({
        status, agiCents, line5dCents: line5d, form2555Line45Cents,
    })
    const line5e = saltWorksheet.w10
    const line6 = fromEntries('Schedule A line 6')(byTag('otherTaxes'))
    const line7 = line5e + line6.value

    // ── Interest You Paid ─────────────────────────────────────────────────
    const line8a = fromEntries('Schedule A line 8a')(byTag('mortgageInterest1098'))
    const line8b = fromEntries('Schedule A line 8b')(byTag('mortgageInterestNo1098'))
    const line8c = fromEntries('Schedule A line 8c')(byTag('pointsNo1098'))
    const line8e = line8a.value + line8b.value + line8c.value
    // Line 9 (Form 4952 investment interest) -- documented zero; see this
    // module's own docstring.
    const line9 = zero('Schedule A line 9 (Form 4952 investment interest expense -- not modeled this phase)')
    const line10 = line8e + line9.value

    // ── Gifts to Charity ──────────────────────────────────────────────────
    const line11 = fromEntries('Schedule A line 11')(byTag('charitableCash'))
    const line12 = fromEntries('Schedule A line 12')(byTag('charitableNonCash'))
    const line13 = fromEntries('Schedule A line 13')(byTag('charitableCarryover'))
    const line14 = line11.value + line12.value + line13.value

    // ── Casualty and Theft Losses ─────────────────────────────────────────
    // Line 15 (Form 4684) -- documented zero; see this module's own docstring.
    const line15 = zero('Schedule A line 15 (Form 4684 casualty/theft losses -- not modeled this phase)')

    // ── Other Itemized Deductions ─────────────────────────────────────────
    const line16 = fromEntries('Schedule A line 16')(byTag('otherItemized'))

    // ── Total Itemized Deductions ───────────────────────────────────────────
    const line17 = line4 + line7 + line10 + line14 + line15.value + line16.value
    // Line 18 -- read VERBATIM from the profile, never inferred.
    const line18 = profile.value.itemizeEvenThoughLessThanStandardDeduction === true

    return {
        kind: 'ok',
        line1, line2, line3, line4,
        line5a, line5b, line5c, line5d, line5e,
        line6, line7,
        line8a, line8b, line8c, line8e,
        line9, line10,
        line11, line12, line13, line14,
        line15, line16, line17,
        line18,
        saltWorksheet,
    }
}

// ── Decision 2.2's withholding-drift check — test-only helper ──────────────
//
// `assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding` itself now lives
// ABOVE `scheduleA` (WR-02, 13-REVIEW.md) — it is production logic, wired
// into every return's real computation, not merely this module's own proof
// fixtures. `refuses` below stays a test-only helper: it lets this module's
// OWN proofs exercise the throwing check function directly, independent of
// `scheduleA`'s try/catch translation into `{ kind: 'error' }`.

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * TY2025's parameter set, narrowed exactly ONCE at module scope, mirroring
 * `fjs/schedule/1a`'s own precedent.
 */
const taxParams2025 = taxParamsByYear[2025]
assert(taxParams2025 !== undefined, 'expected TY2025 parameters to be present in taxParamsByYear')

/** @type {ReturnProfile} */
const minimalProfileValue = {
    dialect: 'vnd.fjs.return_profile',
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [],
}

/** @type {Stored<ReturnProfile>} */
const profileNoDeclaredKinds = { documentHash: 'profile-hash-0001', value: minimalProfileValue }

/** @type {Stored<ReturnProfile>} */
const profileItemizeAnyway = {
    documentHash: 'profile-hash-0002',
    value: { ...minimalProfileValue, itemizeEvenThoughLessThanStandardDeduction: true },
}

/** @type {(amount: string) => (reimbursed: string | undefined) => (hash: string) => Stored<MedicalExpenseEntry>} */
const medicalEntry = amount => reimbursed => hash => ({
    documentHash: hash,
    value: {
        datePaid: '2025-03-01',
        provider: 'Some Provider',
        category: 'medical',
        amount,
        ...(reimbursed === undefined ? {} : { reimbursed }),
    },
})

/** @type {(lineTag: string) => (amount: string) => (hash: string) => Stored<ItemizedEntry>} */
const itemizedEntry = lineTag => amount => hash => ({
    documentHash: hash,
    value: { lineTag, provider: 'Some Provider', amount },
})

/** @type {(rows: readonly { readonly state: string, readonly stateIncomeTax?: string }[]) => (hash: string) => Stored<W2>} */
const w2Fixture = rows => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.w2',
        employerEIN: '11-1111111',
        employeeSSN: '222-22-2222',
        controlNumber: '',
        taxYear: 2025,
        formRevision: '2025',
        box15Through20: rows,
    },
})

/** @type {(rows: readonly { readonly state: string, readonly stateTaxWithheld?: string }[]) => (hash: string) => Stored<OneZeroNineNineR>} */
const oneZeroNineNineRFixture = rows => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099r',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2025',
        stateLocal: rows,
    },
})

/**
 * Asserts the outcome is `kind: 'ok'` and returns it narrowed, so every
 * fixture below can read line fields without repeating the discriminant
 * check — mirrors `fjs/form8812`'s own local `expectOk` precedent exactly.
 * @type {(outcome: ScheduleAOutcome) => ScheduleAOk}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected an ok outcome', outcome])
    return outcome
}

export const proof = {
    // Test 1 (medical floor).
    medicalFloor: {
        aboveFloorFixture: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 8000000n, // $80,000.00
                itemizedEntries: [],
                medicalExpenseEntries: [medicalEntry('10000.00')(undefined)('med-doc-1')],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line1.value, 1000000n, 'line 1 = $10,000.00')
            assertEq(result.line3, 600000n, 'line 3 = $6,000.00 -- 7.5% of $80,000.00')
            assertEq(result.line4, 400000n, 'line 4 = $4,000.00')
        },
        belowFloorFixtureFloorsAtZero: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 8000000n, // $80,000.00
                itemizedEntries: [],
                medicalExpenseEntries: [medicalEntry('5000.00')(undefined)('med-doc-1')],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line3, 600000n, 'line 3 unchanged -- same AGI')
            assertEq(result.line4, 0n, 'line 4 = $0 -- line3 > line1')
        },
        reimbursementReducesLine1: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 0n,
                itemizedEntries: [],
                medicalExpenseEntries: [medicalEntry('1000.00')('400.00')('med-doc-1')],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line1.value, 60000n, 'line 1 = $600.00 -- $1,000 minus $400 reimbursed')
        },
    },

    // Test 2 (SALT flat-then-halved, Pitfall 2) -- THE decisive fixture.
    saltWorksheet: {
        mfsHalvesOnlyTheFinalLine: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'marriedFilingSeparately',
                agiCents: 60000000n, // $600,000.00 -- above the $250,000 MFS threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('30000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line5d, 3000000n, 'line 5d = $30,000.00')
            assertEq(result.saltWorksheet.w1, 4000000n, 'w1 = $40,000.00 -- FLAT, not halved for MFS')
            assertEq(result.saltWorksheet.w6, 35000000n, 'w6 = $350,000.00 ($600,000 - $250,000)')
            assertEq(result.saltWorksheet.w7, 10500000n, 'w7 = $105,000.00 -- 30% of $350,000')
            assertEq(result.saltWorksheet.w8, -6500000n, 'w8 = -$65,000.00 ($40,000 - $105,000)')
            assertEq(result.saltWorksheet.w9, 1000000n, 'w9 = $10,000.00 -- FLAT floor, not halved here')
            assertEq(result.line5e, 500000n, 'line 5e = $5,000.00 -- HALF of w9, the ONLY halved line')
        },
        // The non-MFS control for the SAME excess income: no halving at
        // any line, including w10.
        nonMfsAtTheSameExcessIncomeIsNotHalved: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 100000000n, // $1,000,000.00 -- $500,000 above the single threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('40000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.saltWorksheet.w9, 1000000n, 'w9 = $10,000.00 -- the same flat floor')
            assertEq(result.line5e, 1000000n, 'line 5e = $10,000.00 -- NOT halved for a non-MFS filer')
        },
        // Test 3 (below-threshold skip): collapses to the ordinary cap.
        belowThresholdCollapsesToOrdinaryCapNonMfs: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 40000000n, // $400,000.00 -- below the $500,000 threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('50000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.saltWorksheet.w6, 0n, 'w6 = $0 -- skipped, below threshold')
            assertEq(result.saltWorksheet.w9, 4000000n, 'w9 = w1 = $40,000.00, uncapped')
            assertEq(result.line5e, 4000000n, 'line 5e = $40,000.00 -- the ordinary cap, line5d exceeds it')
        },
        belowThresholdLeavesLine5dUnreducedWhenUnderTheCap: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 40000000n, // $400,000.00 -- below threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('9500.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line5d, 950000n, 'line 5d = $9,500.00')
            assertEq(result.line5e, 950000n, 'line 5e = $9,500.00 -- under the cap, fully deductible')
        },
        // TAX-04 boundary trio: the worksheet's own `<=` edge (w6's skip
        // branch), single filer, at the $500,000 threshold.
        thresholdBoundaryTrioSingle: () => {
            const at = (/** @type {bigint} */ agiCents) => expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('50000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            const below = at(49999999n) // $499,999.99
            assertEq(below.saltWorksheet.w6, 0n, 'one cent below: still skipped')
            const exactly = at(50000000n) // $500,000.00
            assertEq(exactly.saltWorksheet.w6, 0n, 'exactly at: still skipped -- "if zero or less"')
            const above = at(50000001n) // $500,000.01
            assertEq(above.saltWorksheet.w6, 1n, 'one cent above: the `>` branch now fires')
            // One cent of excess x 30% rounds to $0.00 -- coarser than a
            // single cent, exactly the same property `fjs/schedule/1a`'s own
            // boundary trios document at their own rate's granularity. The
            // realMovement fixture below is where the SAME 30% rate visibly
            // bites at dollar-level granularity.
            assertEq(above.line5e, 4000000n, 'one cent of excess is below the rounding threshold')
        },
        // The rate genuinely reduces the cap once the excess is large
        // enough to survive rounding to the nearest cent.
        realMovementAboveThreshold: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 50010000n, // $500,100.00 -- $100.00 above threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('50000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.saltWorksheet.w6, 10000n, 'w6 = $100.00')
            assertEq(result.saltWorksheet.w7, 3000n, 'w7 = $30.00 -- 30% of $100.00, cent-exact')
            assertEq(result.line5e, 3997000n, 'line 5e = $39,970.00 -- $30.00 below the flat cap')
        },
        // **TAX-42: §911's exclusion pushes w4 over the threshold**, and this
        // is the leaf that says printed w3b is live. $480,000.00 of adjusted
        // gross income is BELOW the $500,000.00 threshold and takes the whole
        // $40,000.00 cap; the same filer with a $60,000.00 exclusion has
        // $540,000.00 of phase-down income:
        //   w6 = 540,000 − 500,000 = $40,000.00
        //   w7 = 30% × 40,000      = $12,000.00
        //   w8 = 40,000 − 12,000   = $28,000.00
        //   w9 = max(28,000, 10,000) = $28,000.00 → line 5e
        // The exclusion costs this filer $12,000.00 of deduction, which is
        // exactly what §911 add-backs exist to do.
        theForeignEarnedIncomeExclusionPushesTheSaltCapOverItsThreshold: () => {
            /** @type {(form2555Line45Cents: bigint) => ScheduleAOk} */
            const at = form2555Line45Cents => expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents,
                status: 'single',
                agiCents: 48000000n, // $480,000.00 -- below the threshold on its own
                itemizedEntries: [itemizedEntry('saltIncomeTax')('50000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            const without = at(0n)
            assertEq(without.saltWorksheet.w4, 48000000n, 'bare adjusted gross income')
            assertEq(without.saltWorksheet.w6, 0n, 'below the threshold, so no phase-down')
            assertEq(without.line5e, 4000000n, 'and the whole $40,000.00 cap')
            const withExclusion = at(6000000n)
            assertEq(withExclusion.saltWorksheet.w4, 54000000n, '$480,000.00 + $60,000.00')
            assertEq(withExclusion.saltWorksheet.w6, 4000000n, '$40,000.00 of excess')
            assertEq(withExclusion.saltWorksheet.w7, 1200000n, '30% of it = $12,000.00')
            assertEq(withExclusion.line5e, 2800000n, '$40,000.00 − $12,000.00 = $28,000.00')
        },
                // The floor never breaches below $10,000, even at a very large excess.
        floorNeverBreachedAtLargeExcess: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single',
                agiCents: 900000000n, // $9,000,000.00 -- far above threshold
                itemizedEntries: [itemizedEntry('saltIncomeTax')('50000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.saltWorksheet.w9, 1000000n, 'w9 floors at $10,000.00, never lower')
        },
    },

    // Test 4 (documented zeros): lines 9 and 15 cite the profile's own
    // declaredKinds box, exactly as `fjs/schedule/b`'s Form 8815 boundary does.
    documentedZeros: {
        line9CitesProfileDeclaredKinds: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line9.value, 0n)
            assertEq(result.line9.sources.length, 1)
            assertEq(result.line9.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(result.line9.sources[0].boxPath, 'declaredKinds')
        },
        line15CitesProfileDeclaredKinds: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line15.value, 0n)
            assertEq(result.line15.sources.length, 1)
            assertEq(result.line15.sources[0].documentHash, profileNoDeclaredKinds.documentHash)
            assertEq(result.line15.sources[0].boxPath, 'declaredKinds')
        },
        // An absent tag (e.g. no charitableCarryover entry) falls back to
        // the SAME documented-zero shape via `documentLine` -- distinct
        // from lines 9/15's ALWAYS-zero shape, but structurally identical.
        absentTagFallsBackToDocumentedZero: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('charitableCash')('100.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line13.value, 0n)
            assertEq(result.line13.sources[0].boxPath, 'declaredKinds')
        },
    },

    // Mortgage interest / charitable entries are TRUSTED at face value --
    // no Pub. 936/Pub. 526 limitation arithmetic runs on this schedule's
    // own face (this module's own docstring).
    trustedTaxpayerAssertedLines: {
        mortgageAndCharitableEntriesPassThroughUnlimited: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 100000n, // a trivially small AGI
                itemizedEntries: [
                    itemizedEntry('mortgageInterest1098')('900000.00')('itemized-doc-1'),
                    itemizedEntry('charitableCash')('500000.00')('itemized-doc-2'),
                ],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            // Neither the Pub. 936 acquisition-debt cap nor the Pub. 526
            // 30%/20%-of-AGI limit is applied -- both entries pass through
            // exactly as asserted, even though a $100,000.00 AGI would
            // fail every real Pub. 526 percentage test by a wide margin.
            assertEq(result.line8a.value, 90000000n, 'line 8a = $900,000.00, unreduced')
            assertEq(result.line11.value, 50000000n, 'line 11 = $500,000.00, unreduced')
        },
    },

    // Test 5 (line 18 election): read VERBATIM, no inference.
    line18Election: {
        trueWhenProfileElects: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
                profile: profileItemizeAnyway,
            }))
            assertEq(result.line18, true)
        },
        falseWhenProfileDoesNotElect: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line18, false)
        },
    },

    // CR-01 (13-REVIEW.md): line 5a is a single EITHER/OR election. All
    // three cases pinned as controls: income-tax only, sales-tax only, and
    // BOTH -- the third must refuse, never silently sum.
    saltLine5aElection: {
        incomeTaxOnlyReadsThatOneTag: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('4000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line5a.value, 400000n, 'line 5a = $4,000.00, the income-tax entry alone')
        },
        salesTaxOnlyReadsThatOneTag: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltGeneralSalesTax')('3500.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line5a.value, 350000n, 'line 5a = $3,500.00, the sales-tax entry alone')
        },
        neitherTagPresentIsADocumentedZero: () => {
            const result = expectOk(scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            }))
            assertEq(result.line5a.value, 0n)
            assertEq(result.line5a.sources[0]?.boxPath, 'declaredKinds')
        },
        // THE decisive fixture: a document carrying entries under BOTH tags
        // must refuse -- summing them would silently inflate the SALT
        // deduction, the exact failure CR-01 names.
        bothTagsPresentRefuses: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [
                    itemizedEntry('saltIncomeTax')('4000.00')('itemized-doc-1'),
                    itemizedEntry('saltGeneralSalesTax')('3500.00')('itemized-doc-1'),
                ],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            })
            assertEq(outcome.kind, 'error', 'expected a refusal, never a silently-summed line5a')
            if (outcome.kind === 'error') {
                assert(
                    outcome.message.includes('saltIncomeTax') && outcome.message.includes('saltGeneralSalesTax'),
                    ['expected the refusal to name both mutually exclusive tags', outcome.message],
                )
            }
        },
    },

    // WR-04 (13-REVIEW.md): an unrecognized `lineTag` must refuse LOUDLY,
    // never silently drop money from line 17's total.
    unrecognizedLineTag: {
        knownTagCountIsHandTyped: () => {
            assertEq(knownLineTags.length, expectedKnownLineTagCount)
        },
        misspelledTagRefusesNamingIt: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTaxx')('100.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            })
            assertEq(outcome.kind, 'error', 'expected a refusal, never a silent drop from line 17')
            if (outcome.kind === 'error') {
                assert(
                    outcome.message.includes('saltIncomeTaxx'),
                    ['expected the refusal to name the offending tag', outcome.message],
                )
            }
        },
        // The control: every ONE of the 12 recognized tags, individually,
        // computes normally -- proving the check refuses what is actually
        // unrecognized, not merely "any tag at all".
        everyKnownTagIsTheControlAndComputesNormally: () => {
            for (const lineTag of knownLineTags) {
                const outcome = scheduleA(taxParams2025)({
                    form2555Line45Cents: 0n,
                    status: 'single', agiCents: 0n,
                    itemizedEntries: [itemizedEntry(lineTag)('10.00')('itemized-doc-1')],
                    medicalExpenseEntries: [],
                    profile: profileNoDeclaredKinds,
                })
                assertEq(outcome.kind, 'ok', ['expected the recognized tag to compute, not refuse', lineTag, outcome])
            }
        },
    },

    // Decision 5.8: neither TY2026 OBBBA itemized-deduction change is
    // implemented -- a negative pin. A large charitable gift at a high AGI
    // (where the TY2026 0.5%-of-AGI floor and the 2/37ths haircut would
    // both bite, were either implemented) still deducts in FULL, unreduced.
    obbbaTy2026ChangesNotImplemented: () => {
        const result = expectOk(scheduleA(taxParams2025)({
            form2555Line45Cents: 0n,
            status: 'single',
            agiCents: 100000000n, // $1,000,000.00 -- well into the TY2026 high-income haircut's range
            itemizedEntries: [itemizedEntry('charitableCash')('500.00')('itemized-doc-1')],
            medicalExpenseEntries: [],
            profile: profileNoDeclaredKinds,
        }))
        // The TY2026 0.5%-of-AGI floor would subtract $5,000.00 (0.5% of
        // $1,000,000) from this gift, and would floor a $500.00 gift at
        // $0 entirely. Neither happens: line 11 is the full $500.00.
        assertEq(result.line11.value, 50000n, 'line 11 = $500.00, unreduced by any TY2026 floor')
        assertEq(result.line14, 50000n, 'line 14 = $500.00, unreduced')
    },

    // End-to-end: all six sections computed together for one fixture,
    // hand-totaled independently of `scheduleA`'s own arithmetic.
    computesAllEighteenLinesForAFullyItemizedFixture: () => {
        const result = expectOk(scheduleA(taxParams2025)({
            form2555Line45Cents: 0n,
            status: 'single',
            agiCents: 10000000n, // $100,000.00
            itemizedEntries: [
                itemizedEntry('saltIncomeTax')('6000.00')('itemized-doc-1'),
                itemizedEntry('realEstateTax')('3000.00')('itemized-doc-2'),
                itemizedEntry('personalPropertyTax')('500.00')('itemized-doc-3'),
                itemizedEntry('otherTaxes')('200.00')('itemized-doc-4'),
                itemizedEntry('mortgageInterest1098')('8000.00')('itemized-doc-5'),
                itemizedEntry('pointsNo1098')('500.00')('itemized-doc-6'),
                itemizedEntry('charitableCash')('2000.00')('itemized-doc-7'),
                itemizedEntry('charitableNonCash')('300.00')('itemized-doc-8'),
                itemizedEntry('otherItemized')('150.00')('itemized-doc-9'),
            ],
            medicalExpenseEntries: [medicalEntry('5000.00')(undefined)('med-doc-1')],
            profile: profileItemizeAnyway,
        }))
        assertEq(result.line1.value, 500000n, 'line 1 = $5,000.00')
        assertEq(result.line3, 750000n, 'line 3 = $7,500.00 -- 7.5% of $100,000')
        assertEq(result.line4, 0n, 'line 4 = $0 -- below the floor')
        assertEq(result.line5d, 950000n, 'line 5d = $9,500.00')
        assertEq(result.line5e, 950000n, 'line 5e = $9,500.00 -- well under the $40,000 cap')
        assertEq(result.line7, 970000n, 'line 7 = $9,700.00')
        assertEq(result.line8e, 850000n, 'line 8e = $8,500.00')
        assertEq(result.line9.value, 0n, 'line 9 = $0 -- documented zero')
        assertEq(result.line10, 850000n, 'line 10 = $8,500.00')
        assertEq(result.line14, 230000n, 'line 14 = $2,300.00')
        assertEq(result.line15.value, 0n, 'line 15 = $0 -- documented zero')
        assertEq(result.line16.value, 15000n, 'line 16 = $150.00')
        assertEq(result.line17, 2065000n, 'line 17 = $20,650.00, the grand total')
        assertEq(result.line18, true)
    },

    // ── Decision 2.2's withholding-drift proof ───────────────────────────
    withholdingDriftProof: {
        passesWhenAssertedAtLeastStoredWithholding: () => {
            assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('5000.00')('itemized-doc-1')])(
                [w2Fixture([{ state: 'CA', stateIncomeTax: '4200.00' }])('w2-doc-1')])(
                [])
            // no throw = pass
        },
        // T-13-06's own control: the SAME fixture, with the asserted
        // amount lowered below the stored withholding, fails LOUDLY and
        // names the drift -- not merely "something happened".
        refusesWhenAssertedBelowStoredWithholding: () => {
            refuses(() => assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('1000.00')('itemized-doc-1')])(
                [w2Fixture([{ state: 'CA', stateIncomeTax: '4200.00' }])('w2-doc-1')])(
                []))(message => {
                assert(message.includes('asserted'), ['expected the refusal to name the asserted side', message])
                assert(
                    message.includes('storedWithholding'),
                    ['expected the refusal to name the stored-withholding side', message],
                )
            })
        },
        // Election-gated: the SAME vastly-understating W-2 withholding does
        // NOT refuse when the taxpayer elected general sales tax instead --
        // proving this proof is gated on the income-tax election, not a
        // blanket check over every return.
        noOpWhenGeneralSalesTaxElectionInForce: () => {
            assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltGeneralSalesTax')('100.00')('itemized-doc-1')])(
                [w2Fixture([{ state: 'CA', stateIncomeTax: '999999.00' }])('w2-doc-1')])(
                [])
            // no throw = pass, even though $999,999 >> $100 -- the check
            // never even looked, because no saltIncomeTax entry exists.
        },
        combinesW2And1099RWithholding: () => {
            const w2s = [w2Fixture([{ state: 'CA', stateIncomeTax: '100.00' }])('w2-doc-1')]
            const rs = [oneZeroNineNineRFixture([{ state: 'CA', stateTaxWithheld: '100.00' }])('1099r-doc-1')]
            assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('300.00')('itemized-doc-1')])(w2s)(rs)
            // $300 >= $100 (W-2) + $100 (1099-R) = $200 -- passes.
            refuses(() => assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('150.00')('itemized-doc-1')])(w2s)(rs))(message => {
                assert(message.includes('asserted'), ['expected the refusal to name the asserted side', message])
            })
        },
        multipleWithheldRowsAcrossMultipleDocumentsAllCount: () => {
            const w2s = [
                w2Fixture([{ state: 'CA', stateIncomeTax: '100.00' }, { state: 'NY', stateIncomeTax: '50.00' }])('w2-doc-1'),
                w2Fixture([{ state: 'CA', stateIncomeTax: '25.00' }])('w2-doc-2'),
            ]
            // $100 + $50 + $25 = $175 total -- $174.99 asserted must refuse.
            refuses(() => assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('174.99')('itemized-doc-1')])(w2s)([]))(message => {
                assert(message.includes('storedWithholding'), ['expected the drift named', message])
            })
            // $175.00 exactly is enough.
            assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('175.00')('itemized-doc-1')])(w2s)([])
        },
        // A row that names a STATE but no withheld amount contributes ZERO,
        // on both faces. `stateIncomeTax` and `stateTaxWithheld` are optional
        // in their own dialects (`fjs/document/w2` proves `{ state: 'TX' }`
        // validates), and the ordinary reason for the shape is a state that
        // levies no income tax at all: box 15 still names it, boxes 16-17 are
        // blank. Treating such a row as anything but zero would raise the
        // stored-withholding side and refuse a return whose asserted line 5a
        // is perfectly consistent.
        //
        // Proved by PINNING THE TOTAL rather than by not throwing: each
        // document carries one blank row and one withheld row, and the
        // refusal one cent below the sum prints `storedWithholding 10000` --
        // $100.00, which is the two withheld rows and nothing else. If a
        // blank row were read as anything, that hand-typed figure moves.
        aRowNamingAStateWithNoWithheldAmountAddsNothingToEitherSide: () => {
            const w2s = [w2Fixture([{ state: 'TX' }, { state: 'CA', stateIncomeTax: '90.00' }])('w2-doc-1')]
            const rs = [oneZeroNineNineRFixture(
                [{ state: 'TX' }, { state: 'CA', stateTaxWithheld: '10.00' }])('1099r-doc-1')]
            // $90.00 + $10.00 = $100.00 exactly, so $100.00 asserted passes.
            assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('100.00')('itemized-doc-1')])(w2s)(rs)
            refuses(() => assertAssertedSaltIncomeTaxIsAtLeastStoredWithholding(
                [itemizedEntry('saltIncomeTax')('99.99')('itemized-doc-1')])(w2s)(rs))(message => {
                assert(
                    message.includes('asserted 9999 storedWithholding 10000'),
                    ['expected the blank rows to add nothing to either side of the drift', message],
                )
            })
        },
        // …and the same two blank rows reach the line the schedule actually
        // prints: line 5a is the taxpayer-asserted figure, unmoved, and the
        // return computes rather than refusing.
        aBlankWithholdingRowDoesNotRefuseARealReturn: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('1200.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
                w2Forms: [w2Fixture([{ state: 'TX' }])('w2-doc-1')],
                oneZeroNineNineRForms: [oneZeroNineNineRFixture([{ state: 'TX' }])('1099r-doc-1')],
            })
            assertEq(outcome.kind, 'ok', 'a no-income-tax state withheld nothing; there is no drift to refuse')
            if (outcome.kind === 'ok') {
                assertEq(outcome.line5a.value, 120000n, 'line 5a = the asserted $1,200.00')
                assertEq(outcome.line5d, 120000n, 'line 5d = $1,200.00 -- 5a is its only summand here')
            }
        },
    },

    // WR-02 (13-REVIEW.md): the SAME withholding-drift check, now exercised
    // through `scheduleA(...)` ITSELF -- never a fixture written by this
    // proof for its own sake, since `w2Forms`/`oneZeroNineNineRForms` are
    // ScheduleAInput's own real fields, the SAME fields `fjs/form1040/core`
    // feeds from the return's own stored documents.
    withholdingDriftWiredIntoScheduleA: {
        realReturnWithUnderstatedSaltIncomeTaxRefuses: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('1000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
                w2Forms: [w2Fixture([{ state: 'CA', stateIncomeTax: '4200.00' }])('w2-doc-1')],
                oneZeroNineNineRForms: [],
            })
            assertEq(outcome.kind, 'error', 'expected a refusal, never a silently-accepted understated SALT entry')
            if (outcome.kind === 'error') {
                assert(
                    outcome.message.includes('asserted') && outcome.message.includes('storedWithholding'),
                    ['expected the refusal to name both sides of the drift', outcome.message],
                )
            }
        },
        // The control: the SAME W-2, with the asserted amount raised to
        // cover the stored withholding, computes normally through
        // `scheduleA(...)` -- proving the wiring refuses drift specifically,
        // not every return that happens to carry a W-2 alongside SALT.
        realReturnWithConsistentSaltIncomeTaxComputesNormally: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('5000.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
                w2Forms: [w2Fixture([{ state: 'CA', stateIncomeTax: '4200.00' }])('w2-doc-1')],
                oneZeroNineNineRForms: [],
            })
            assertEq(outcome.kind, 'ok', 'expected the consistent return to compute, not refuse')
            if (outcome.kind === 'ok') {
                assertEq(outcome.line5a.value, 500000n, 'line 5a still reads the taxpayer-asserted $5,000.00 -- never the withheld figure')
            }
        },
        // A caller supplying NEITHER document array (the default `?? []`)
        // behaves exactly as before WR-02 -- the drift check is a no-op
        // with nothing to compare against, never a spurious refusal.
        omittedDocumentArraysAreANoOp: () => {
            const outcome = scheduleA(taxParams2025)({
                form2555Line45Cents: 0n,
                status: 'single', agiCents: 0n,
                itemizedEntries: [itemizedEntry('saltIncomeTax')('1.00')('itemized-doc-1')],
                medicalExpenseEntries: [],
                profile: profileNoDeclaredKinds,
            })
            assertEq(outcome.kind, 'ok', 'expected no refusal when no W-2/1099-R documents are supplied at all')
        },
    },

    // This module computes a schedule, not a stored document: no `dialect`/
    // `mediaType`, mirroring `fjs/schedule/b`'s own `dialectIndependence` leaf.
    dialectIndependence: () => {
        const result = expectOk(scheduleA(taxParams2025)({
            form2555Line45Cents: 0n,
            status: 'single', agiCents: 0n, itemizedEntries: [], medicalExpenseEntries: [],
            profile: profileNoDeclaredKinds,
        }))
        assert(!('dialect' in result), 'scheduleA output must not carry a dialect tag')
        assert(!('mediaType' in result), 'scheduleA output must not carry a mediaType')
    },
}
