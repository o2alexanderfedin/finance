/**
 * Form 8949 — TAX-11: category derivation (A/B/D/E) and per-category totals
 * over stored `vnd.fjs.1099b` documents; **TAX-34 (Phase 29): column (f)'s
 * adjustment code and column (g)'s amount.**
 *
 * ## TAX-34, and the largest silent overstatement this engine has found
 *
 * A broker reports what §6045 obliges it to report, which for stock acquired
 * through equity compensation is the employee's own cash outlay — for a
 * restricted stock unit, **zero**. The value of the shares at vesting is
 * compensation; it is inside Form W-2 box 1; tax has already been withheld on
 * it. A return that reads box 1e as printed therefore taxes that value a
 * SECOND time as a capital gain, and every line looks right while it does so.
 * The printed Instructions for Form 8949 (2025) say it outright, under
 * *Column (e)*: *"the basis information reported to you on Form 1099-B ...
 * won't reflect any amount you included in income upon grant or exercise of
 * the option. Increase your basis by any amount you included in income."*
 *
 * `vnd.fjs.basis_correction` is where the taxpayer says so, and this module is
 * where the printed form's two presentations of that one fact are derived.
 * **Nothing is adjusted that the taxpayer did not assert** — there is no
 * heuristic here, no "box 1e looks like zero so it probably is an RSU". An
 * adjustment the engine cannot derive from an assertion is a refusal, never a
 * guess.
 *
 * ## The two presentations, and why the DIALECT stores neither
 *
 * `i8949.pdf`'s *Worksheet for Basis Adjustments in Column (g)*, transcribed:
 *
 * - **Basis NOT reported to the IRS** (box 12 unchecked — this module's
 *   category B or E): *"enter the correct basis in column (e) and enter -0- in
 *   column (g)"*. The correction lands in column (e) itself.
 * - **Basis reported to the IRS** (box 12 checked — category A or D): *"enter
 *   the reported basis shown on Form 1099-B in column (e) and use this
 *   worksheet to figure the adjustment"*, whose lines 3 and 4 come to
 *   `reported − correct`, negative in parentheses when the correct basis is
 *   larger. The correction lands in column (g).
 *
 * Same taxpayer fact, two printed presentations, selected by a checkbox the
 * taxpayer does not control. So `vnd.fjs.basis_correction` stores the correct
 * BASIS and {@link form8949} derives the presentation — mechanically, in one
 * place. Column (h) is `(d) − (e) + (g)` either way, and comes to the same
 * number under both, which {@link proof}.basisAdjustment's own
 * `bothPresentationsOfOneCorrectionReachTheSameGain` leaf pins.
 *
 * ## Column (f) is a VOCABULARY, and this engine emits exactly one of it
 *
 * {@link adjustmentCodes} carries all eighteen codes the printed table
 * defines, in the table's own order, and {@link adjustmentCodeDispositions}
 * gives each one a disposition: EMITTED, REFUSED (this engine holds the fact
 * and cannot compute what the code needs), or UNREACHABLE (no input shape here
 * could ever select it). The mapping is total by construction —
 * `everyPrintedCodeHasExactlyOneDisposition` walks the vocabulary rather than
 * the disposition table, so a code added without a disposition reddens.
 *
 * **Exactly one code is emitted: `B`.** Two are REFUSED, and they are the two
 * boxes this module already refused before TAX-34 existed — the refusals are
 * unchanged in effect and sharper in wording, because each now names the code
 * it would have had to emit and what is missing:
 *
 * - **`D`, accrued market discount (box 1f).** The worksheet's line 5 is not
 *   the hard part; the sentence after it is: *"Also, report it as interest
 *   income on your tax return."* The adjustment moves money out of a capital
 *   gain and INTO 1040 line 2b, and this module computes neither line 2b nor
 *   anything that reaches it. Emitting the column (g) half alone would
 *   understate the return by the whole of the ordinary-income half.
 * - **`W`, wash sale (box 1g).** The disallowed loss is added back as a
 *   positive column (g) adjustment, which by itself is mechanical. It is not
 *   emitted anyway, for a reason of scope rather than of principle: the
 *   printed instruction has the taxpayer enter *"the correct amount of the
 *   nondeductible loss"*, which may differ from box 1g, and a disallowed loss
 *   exceeding the loss itself would turn a loss into a gain with no printed
 *   cap to stop it. TAX-34 names code B; this row records exactly what would
 *   have to be decided to add code W, so the next phase does not have to
 *   rediscover it.
 *
 * The other fifteen are UNREACHABLE, each for a stated reason, and eleven of
 * those reasons are the same one: this dialect models broker-reported sales of
 * securities and nothing else.
 *
 * ## Codes are emitted in ALPHABETICAL order, which is NOT the table's order
 *
 * *"If more than one code applies, enter all the codes that apply in
 * alphabetical order (for example, 'BOQ'). Don't separate the codes by a space
 * or comma."* The printed TABLE, meanwhile, runs B, C, D, E, H, L, M, N, P, Q,
 * R, S, T, W, X, Y, Z and then **O**, out of alphabetical order, at the end.
 * {@link adjustmentCodes} preserves the table's order because that is what was
 * read off the page; {@link columnFCode} sorts. With one emitted code the two
 * are indistinguishable today, and `theCodesAreEmittedInAlphabeticalOrder` is
 * what keeps the rule true for the day a second one is emitted.
 *
 * ## Form 3922 and a sale in the same return: a refusal, not an adjustment
 *
 * A stored `vnd.fjs.form3922` says the taxpayer acquired stock through an
 * employee stock purchase plan. If the same return reports ANY sale, this
 * module refuses — see {@link employeeStockPurchaseRefusal} for the three
 * facts that are missing and why none of them is derivable here.
 *
 * Source, fetched and read directly (12.1-RESEARCH.md), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/i8949.pdf` (2025 revision, printed
 * `Jan 20, 2026`), pp.3-4, "Part I"/"Part II". `f1040sd.pdf` p.1 (lines
 * 1a-b/2/3/8a-b/9/10) confirms these are the four categories that feed
 * Schedule D from a `vnd.fjs.1099b`-sourced transaction.
 *
 * This is a STANDALONE, independently callable pure function over stored
 * `vnd.fjs.1099b` documents — the same relationship `fjs/schedule/b` has to
 * `vnd.fjs.1099int`/`vnd.fjs.1099div`. It is NOT wired into Form 1040's own
 * income-line aggregation, and it does not consult the return-scope guard's
 * classification function. It imports NOTHING at runtime from `fjs/tax/`,
 * `fjs/return/`, or `fjs/form1040/` — every type this module reads from
 * `fjs/document/1099b` is pulled in via a type-only JSDoc `@import`, never a
 * runtime `import` statement, because this module stores and reads nothing
 * of its own; it only derives a category and a total from a value someone
 * else already validated and handed it.
 *
 * ## Six categories reachable from `vnd.fjs.1099b`, of twelve the form prints
 *
 * `i8949.pdf`'s own "What's New" section: TY2025 added boxes G/H/I and J/K/L
 * for digital-asset (Form 1099-DA) transactions, mirroring A/B/C and D/E/F
 * respectively. This dialect has no Form 1099-DA source, so G-L are simply
 * unreachable here — not refused, not modeled, structurally absent because
 * nothing in `vnd.fjs.1099b` could ever select them.
 *
 * ## Categories C and F (no 1099-B received) are OUT OF SCOPE
 *
 * Category C ("Short-term transactions not reported to you on Form 1099-B")
 * and Category F (the long-term mirror) exist on the printed form for
 * property a taxpayer disposed of WITHOUT receiving a 1099-B at all — there
 * is no box to read, because the whole premise is the absence of a broker
 * statement. This dialect only models broker-reported sales (12.1-CONTEXT.md
 * "Out of scope"), so this module has no input shape that could ever produce
 * a Category C or F row, and none is attempted. A future phase modeling
 * self-reported dispositions would need a new document type, not a change to
 * this one.
 *
 * ## Boxes 1f (accrued market discount) and 1g (wash sale loss disallowed)
 *
 * Form 8949's own column (g) carries adjustment codes (`D` for accrued
 * market discount, `W` for a wash sale) that change the reported gain/loss
 * away from the raw proceeds-minus-basis figure this module computes.
 * Silently ignoring a present box 1f/1g value would compute a confidently
 * WRONG gain (12.1-CONTEXT.md Decision 1.4) — the one outcome this engine
 * exists to prevent — so instead {@link form8949} refuses, gracefully, the
 * moment either box is present on any document it is asked to categorize.
 * This is a document-data-sufficiency refusal, not a scope refusal: it is
 * built here, directly, as this module's own `Form8949Error`, and does NOT
 * call `fjs/return/scope`'s `scopeRefusal`.
 *
 * **Phase 29 keeps both refusals and rewords them.** The original reason —
 * *"this phase builds no adjustment-code machinery"* — stopped being true the
 * moment TAX-34 built it, so each refusal now names the CODE it would have to
 * emit and the specific thing that is missing. See
 * {@link adjustmentCodeDispositions}' own `D` and `W` rows, which are where
 * those two reasons are written down once and read by the refusals.
 *
 * ## Category derivation, and why the payer's own letter is never the input
 *
 * The category is DERIVED from `box12BasisReportedToIrs` crossed with
 * `box2ShortTermGainOrLoss`/`box2LongTermGainOrLoss` — never read off
 * `applicableCheckboxOnForm8949`, the payer-printed letter. `i8949.pdf`'s own
 * language for a substitute statement is advisory ("may also tell you which
 * box to check"), not authoritative, and 12.1-CONTEXT.md Decision 2.4 is
 * explicit that trusting the payer's letter directly would make this
 * engine's own categorization unverifiable. `applicableCheckboxOnForm8949`
 * is read only inside this module's own `proof`, as a second source a test
 * can watch drift — never as an input to {@link form8949} itself.
 *
 * ## Absent-basis refusal (Decision 2.6) — the ONLY place this module refuses
 *
 * A GENUINELY absent `box1eCostOrOtherBasis` (never a present `'0.00'`) has
 * no basis to compute a gain from at all, and is categorically different
 * from `box12BasisReportedToIrs` being unchecked (which means "the broker
 * knows the basis and simply didn't report it to the IRS" — fully
 * computable, Category B or E). `fjs/document/1099b`'s own
 * `criterion2GainConsequence` proof demonstrates the dollar consequence with
 * a proof-local helper over a DIALECT that only stores and reads; this
 * module is where that consequence first has PRODUCTION computation
 * teeth — Mutation Gate M1 (12.1-VALIDATION.md) reddens this exact path,
 * not a fixture-local stand-in for it.
 *
 * ## Refusal check order — stable and documented, because Mutation Gate M1 targets one of them
 *
 * For each document that has a `box1dProceeds` reading at all (see the
 * control case below), the checks run in this fixed order: box 1f/1g present
 * (case 2), THEN absent basis (case 1), THEN an undecided category — neither
 * holding-period box set, or `box2Ordinary` set (case 3). The first one that
 * applies short-circuits the whole computation with a `Form8949Error`; nail
 * this order down because Task 2's Mutation Gate M1 mutates the absent-basis
 * check specifically, and a reordering could make that mutation land on a
 * document that never reaches it.
 *
 * The four box-sum/reducer helpers this module needs are reimplemented
 * locally and privately, following `fjs/schedule/b/module.f.js:98-158`'s
 * shape but adapted: this module classifies ONE document into a category
 * and then accumulates, rather than summing one box name across many
 * documents — see {@link categorize} and {@link form8949} — because Form
 * 8949 has no single box name to sum; the amount landing in each category
 * depends on that document's own classification.
 *
 * @module
 */
import { assert, assertEq, assertNotNullish } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../exact/module.f.js'

/** @import { OneZeroNineNineB } from '../document/1099b/module.f.js' */
/** @import { BasisCorrection } from '../document/basis_correction/module.f.js' */
/** @import { FormThirtyNineTwentyTwo } from '../document/form3922/module.f.js' */
/** @import { Source } from '../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it: the CAS hash it is addressed by,
 * paired with its ALREADY-VALIDATED value. Nothing here re-validates — a blob
 * that never passed `vnd.fjs.1099b`'s own `validate` has no business
 * reaching a Form 8949 category (mirrors `fjs/schedule/b`'s own `Stored<T>`).
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything this module reads. **A parameter object as of Phase 29**, where
 * it used to be a bare `readonly Stored<OneZeroNineNineB>[]`: TAX-34 needs the
 * taxpayer's basis corrections, and the Form 3922 refusal needs to know an
 * employee stock purchase plan is in play. `fjs/schedule/d`'s own
 * `ScheduleDInputs` is the shape this follows, one module up.
 *
 * Both new fields are LISTS and both are required rather than optional. A
 * return with no corrections passes `[]`, which is a legitimate "the broker
 * got every basis right" and never a refusal — the same distinction
 * `fjs/schedule/d` draws for `priorYearCapitalLossCarryover`, made at the type
 * level here because an omitted list and an empty one would otherwise be
 * indistinguishable to a caller that simply forgot to wire it.
 * @typedef {{
 *   readonly brokerageForms: readonly Stored<OneZeroNineNineB>[],
 *   readonly basisCorrections: readonly Stored<BasisCorrection>[],
 *   readonly employeeStockPurchaseForms: readonly Stored<FormThirtyNineTwentyTwo>[],
 * }} Form8949Inputs
 */

// ── Column (f): the adjustment-code vocabulary ──────────────────────────────

/**
 * Every column (f) adjustment code the printed instructions define, **in the
 * printed table's own order** — which runs B through Z and then puts `O`
 * last, out of alphabetical order, exactly as `i8949.pdf` (2025) pp.8-10
 * prints it.
 *
 * Transcribed from the table headed *"How To Complete Form 8949, Columns (f)
 * and (g)"*, fetched and read directly 2026-08-16. The order is preserved
 * because it is what was READ; emission sorts alphabetically, which is a
 * different rule the same instructions state one column over (see
 * {@link columnFCode}).
 * @type {readonly string[]}
 */
export const adjustmentCodes = [
    'B', 'C', 'D', 'E', 'H', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'W', 'X', 'Y', 'Z', 'O',
]

/**
 * Independently HAND-TYPED: how many codes the printed table defines. Never
 * `adjustmentCodes.length` — {@link adjustmentCodeDispositions} is walked
 * against this vocabulary and both would shrink together (AGENTS.md's fourth
 * shipped defect).
 * @type {number}
 */
const expectedAdjustmentCodeCount = 18

/**
 * What this engine does about each printed code. Three dispositions, and the
 * distinction between the last two is the whole point of the table:
 *
 * - `'emitted'` — this module produces the code, from facts it holds.
 * - `'refused'` — this module HOLDS a fact that selects the code and cannot
 *   honestly compute what the code needs, so the whole computation refuses by
 *   name. A refusal is reachable; somebody's real return hits it.
 * - `'unreachable'` — no input shape this module accepts could ever select the
 *   code. Not refused, not modeled, structurally absent — the same word
 *   {@link categorize}'s own docstring uses for Form 8949 categories G-L.
 *
 * **`'unreachable'` is a claim about the INPUT TYPES, and it is the one that
 * rots.** Widen `vnd.fjs.1099b`, or add a Form 1099-S or Form 1099-DA dialect,
 * and several of these become reachable in the same commit — with no failing
 * test, because nothing here would notice. `everyUnreachableCodeNamesTheInput\
 * ShapeThatWouldReachIt` is the mitigation available: each reason names the
 * document or election that would make it reachable, so a reader adding that
 * document can grep for it.
 * @type {readonly { readonly code: string, readonly disposition: 'emitted' | 'refused' | 'unreachable', readonly reason: string }[]}
 */
export const adjustmentCodeDispositions = [
    {
        code: 'B',
        disposition: 'emitted',
        reason: 'the basis shown in box 1e is incorrect and the taxpayer has stored a '
            + 'vnd.fjs.basis_correction saying what the correct basis is. TAX-34, and the reason '
            + 'this module exists in its present form.',
    },
    {
        code: 'C',
        disposition: 'unreachable',
        reason: 'collectibles. Form 1099-B box 3 does carry a collectibles checkbox and this '
            + 'dialect stores it as box3CollectiblesProceeds, but the 28%-rate treatment behind '
            + 'the code lives in Schedule D\'s own 28% Rate Gain Worksheet, whose line 1 '
            + '(collectibles from Form 8949 Part II) is a documented zero under Decision 2.5. '
            + 'Reachable the day that worksheet line stops being hardcoded.',
    },
    {
        code: 'D',
        disposition: 'refused',
        reason: 'accrued market discount, Form 1099-B box 1f. The column (g) half is a printed '
            + 'worksheet this module could run, but its last line reads "Also, report it as '
            + 'interest income on your tax return" — the adjustment moves money out of a capital '
            + 'gain and INTO 1040 line 2b, and this module computes neither line 2b nor anything '
            + 'that reaches it. Emitting the capital-gain half alone would understate the return '
            + 'by the whole of the ordinary-income half.',
    },
    {
        code: 'E',
        disposition: 'unreachable',
        reason: 'selling expenses, option premiums or digital-asset transaction costs not '
            + 'reflected on the form. No document this engine holds reports any of the three: a '
            + 'broker nets commissions into box 1d rather than reporting them, and an option '
            + 'premium the taxpayer paid or received is on no information return at all. '
            + 'Reachable the day a taxpayer-asserted selling-expense record exists.',
    },
    {
        code: 'H',
        disposition: 'unreachable',
        reason: 'the §121 exclusion on the sale of a main home, which is reported on Form 1099-S. '
            + 'This engine has no vnd.fjs.1099s dialect and no residence-sale input of any kind.',
    },
    {
        code: 'L',
        disposition: 'unreachable',
        reason: 'a nondeductible loss other than a wash sale — a sale to a related party under '
            + '§267, or a loss on personal-use property. Neither is derivable from a Form 1099-B: '
            + 'a broker does not know the counterparty is the taxpayer\'s brother.',
    },
    {
        code: 'M',
        disposition: 'unreachable',
        reason: 'multiple transactions reported on a single row under Exception 2. This module '
            + 'emits one row per stored Form 1099-B and never aggregates two documents into one '
            + 'row, so the shape the code describes cannot arise.',
    },
    {
        code: 'N',
        disposition: 'unreachable',
        reason: 'the taxpayer received the Form 1099-B as a NOMINEE for the actual owner. '
            + 'Nothing on the form says so, and vnd.fjs.1099b has no nominee field — the fact is '
            + 'the taxpayer\'s, not the broker\'s, and no taxpayer-asserted dialect carries it.',
    },
    {
        code: 'P',
        disposition: 'unreachable',
        reason: 'a nonresident alien, foreign trust, foreign estate or foreign corporation '
            + 'disposing of a partnership interest under Regulations §1.864(c)(8)-1. This engine '
            + 'computes Form 1040 for individuals and has no Form 1040-NR path.',
    },
    {
        code: 'Q',
        disposition: 'unreachable',
        reason: 'the §1202 exclusion on qualified small business stock. The exclusion percentage '
            + '(50/60/75/100%) turns on when the stock was acquired, which no Form 1099-B box '
            + 'reports — the same gap fjs/return/scope\'s `section1202Gain` row already refuses '
            + 'by name at 1099-DIV box 2c.',
    },
    {
        code: 'R',
        disposition: 'unreachable',
        reason: 'an ELECTION to postpone gain on a rollover. No document this engine holds '
            + 'records an election, which is the same reason Schedule SE\'s optional methods are '
            + 'refused rather than computed.',
    },
    {
        code: 'S',
        disposition: 'unreachable',
        reason: 'a §1244 small business stock loss above the amount treatable as ordinary. '
            + 'Whether stock is §1244 stock is a fact about the issuing corporation at issuance, '
            + 'on no information return.',
    },
    {
        code: 'T',
        disposition: 'unreachable',
        reason: 'the type of gain or loss shown in box 2 is INCORRECT. This module derives the '
            + 'holding period from box 2 and has no second source to contradict it with; a '
            + 'taxpayer asserting the broker got the holding period wrong has nowhere to say so.',
    },
    {
        code: 'W',
        disposition: 'refused',
        reason: 'a nondeductible wash-sale loss, Form 1099-B box 1g. Adding box 1g back as a '
            + 'positive column (g) adjustment is mechanical, and it is still not emitted: the '
            + 'printed instruction has the taxpayer enter "the correct amount of the '
            + 'nondeductible loss", which may differ from box 1g and which no stored document '
            + 'carries, and a box 1g exceeding the loss itself would turn a loss into a gain with '
            + 'no printed cap to stop it. TAX-34 names code B; this row records exactly what a '
            + 'later phase has to decide.',
    },
    {
        code: 'X',
        disposition: 'unreachable',
        reason: 'the DC Zone asset and qualified community asset exclusions, both of which '
            + 'expired for assets acquired after 2011 and neither of which any stored document '
            + 'identifies.',
    },
    {
        code: 'Y',
        disposition: 'unreachable',
        reason: 'gain previously deferred in a qualified opportunity fund. Form 1099-B box 3 '
            + 'carries a QOF checkbox and this dialect stores it as box3QofProceeds, but the '
            + 'deferred amount and the year it was deferred are on the prior year\'s Form 8949, '
            + 'which is multi-year history this engine does not hold.',
    },
    {
        code: 'Z',
        disposition: 'unreachable',
        reason: 'an ELECTION to defer gain by investing in a qualified opportunity fund. An '
            + 'election again, and the same answer as code R.',
    },
    {
        code: 'O',
        disposition: 'unreachable',
        reason: 'the catch-all, "an adjustment not explained earlier in this column". A '
            + 'catch-all is by construction not derivable from any particular stored fact, so '
            + 'there is no input shape here that selects it. Its position LAST in the printed '
            + 'table, out of alphabetical order, is why adjustmentCodes preserves the table\'s '
            + 'order rather than sorting it.',
    },
]

/**
 * One code emitted by this module. Exactly one member today, and it is a
 * literal type rather than `string` so a second emitted code has to be added
 * here on purpose.
 * @typedef {'B'} EmittedCode
 */

/**
 * The codes for one row, rendered as column (f) prints them: concatenated with
 * no separator, **in ALPHABETICAL order** — *"enter all the codes that apply
 * in alphabetical order (for example, 'BOQ'). Don't separate the codes by a
 * space or comma."* An empty list renders as the empty string, which is what
 * a row with no adjustment leaves in the box.
 *
 * `[...codes].sort()` copies before sorting: `Array.prototype.sort` mutates in
 * place, and the argument here is a locally built array today but need not
 * stay one.
 * @type {(codes: readonly EmittedCode[]) => string}
 */
const columnFCode = codes => [...codes].sort().join('')

// ── Output contract (Plan 12.1-03, Schedule D, builds against this) ────────

/**
 * One category's running total: the exact cents sum of **column (h)**,
 * `(d) − (e) + (g)`, over every document landing in that category, with a
 * {@link Source} entry per box actually read. A category with no contributing
 * document is `{ value: 0n, unadjustedValue: 0n, sources: [] }` — a PLAIN,
 * possibly-empty array, deliberately not a `ReportLine`: this is an
 * intermediate Schedule D composes further, not a line a report renders on its
 * own.
 *
 * **`unadjustedValue` is what the return would have said with no basis
 * correction at all**, and it exists so the double taxation can be PRICED
 * rather than merely avoided. For a row with a correction it is
 * `proceeds − reportedBasis`; the difference from `value` is exactly
 * `correctedBasis − reportedBasis`, which is the amount of already-taxed
 * compensation that would have been taxed a second time. It is identical to
 * `value` for every row without a correction, and — deliberately — also for a
 * row whose box 1e was genuinely ABSENT, because there the alternative to the
 * correction was not a wrong number but a refusal, and there is no
 * overstatement to price.
 * @typedef {{
 *   readonly value: bigint,
 *   readonly unadjustedValue: bigint,
 *   readonly sources: readonly Source[],
 * }} CategoryTotal
 */

/**
 * One printed Form 8949 row, in the printed columns' own order. Carried out
 * beside the category totals rather than reconstructed by a caller, so a
 * report that renders the form shows the SAME code and adjustment the totals
 * were computed from. `columnA` is the description as the broker printed it,
 * or the empty string where box 1a was blank — the printed form requires a
 * description and this module never invents one.
 * @typedef {{
 *   readonly documentHash: string,
 *   readonly category: 'A' | 'B' | 'D' | 'E',
 *   readonly columnA: string,
 *   readonly columnDProceeds: bigint,
 *   readonly columnEBasis: bigint,
 *   readonly columnFCode: string,
 *   readonly columnGAdjustment: bigint,
 *   readonly columnHGain: bigint,
 * }} Form8949Row
 */

/**
 * The four categories this project's `vnd.fjs.1099b` dialect can drive,
 * each an independent {@link CategoryTotal}, plus the printed rows they were
 * summed from.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly categoryA: CategoryTotal,
 *   readonly categoryB: CategoryTotal,
 *   readonly categoryD: CategoryTotal,
 *   readonly categoryE: CategoryTotal,
 *   readonly rows: readonly Form8949Row[],
 * }} Form8949Ok
 */

/**
 * The graceful, tagged refusal Decision 2.6 requires — shaped like
 * `fjs/return/scope`'s `ScopeError` / `fjs/tax/line16`'s `Line16Error`, but
 * NOT built by `scopeRefusal` and NOT a new `fjs/return/scope` kind: this is
 * a document-data-sufficiency problem (can THIS document's gain be honestly
 * computed?), not a declared-kind scope problem (should this taxpayer's
 * return be computed at all?). `message` names the document hash and the
 * specific reason (which box forces the refusal), so a caller rendering this
 * error can say something concrete rather than merely "refused".
 * @typedef {{ readonly kind: 'error', readonly message: string }} Form8949Error
 */

/** @typedef {Form8949Ok | Form8949Error} Form8949Outcome */

// ── Category derivation ─────────────────────────────────────────────────────

/**
 * Derives the Form 8949 category (A, B, D, or E) for one document from its
 * OWN boxes alone — never from `applicableCheckboxOnForm8949` (see module
 * docstring). Returns `undefined` when the category is undecided: either
 * `box2Ordinary` is set (ordinary income, not a capital transaction — the
 * printed instructions' third checkbox, out of scope by the same reasoning
 * as wash sales) or NEITHER `box2ShortTermGainOrLoss` nor
 * `box2LongTermGainOrLoss` is `true` (the broker didn't know the holding
 * period, and `i8949.pdf` p.2 directs the taxpayer to "use your own
 * records" — a fallback this dialect has no field for).
 *
 * `box2Ordinary` is checked FIRST, ahead of the short/long-term boxes, so a
 * document that (incorrectly, but structurally possible under this dialect's
 * independent-checkbox modeling) sets `box2Ordinary` alongside a holding-
 * period box still refuses rather than silently computing a capital gain for
 * income the payer marked ordinary. If both `box2ShortTermGainOrLoss` and
 * `box2LongTermGainOrLoss` are set (also structurally possible, though not a
 * shape any real 1099-B should print), short-term wins — a documented,
 * arbitrary-but-stable tie-break, not a case this dialect's real-world
 * fixtures are expected to exercise.
 * @type {(document: Stored<OneZeroNineNineB>) => 'A' | 'B' | 'D' | 'E' | undefined}
 */
const categorize = document => {
    const box = document.value
    if (box.box2Ordinary === true) {
        return undefined
    }
    if (box.box2ShortTermGainOrLoss === true) {
        return box.box12BasisReportedToIrs === true ? 'A' : 'B'
    }
    if (box.box2LongTermGainOrLoss === true) {
        return box.box12BasisReportedToIrs === true ? 'D' : 'E'
    }
    return undefined
}

// ── Aggregation (the `sumBoxOverDocuments`/`addBoxSums` idiom, adapted) ─────

/**
 * An empty {@link CategoryTotal} — the starting point for every category,
 * and what a category with no contributing document stays at.
 * @type {CategoryTotal}
 */
const emptyCategoryTotal = { value: 0n, unadjustedValue: 0n, sources: [] }

/**
 * Adds one document's column (h) gain, its uncorrected counterpart and its
 * {@link Source} entries into a category's running total. The adapted shape of
 * `fjs/schedule/b`'s `addBoxSums`: that idiom adds two sums of the SAME box
 * across documents; this adds one document's contribution into the category it
 * was just classified into.
 * @type {(total: CategoryTotal) => (gainCents: bigint) => (unadjustedGainCents: bigint) => (sources: readonly Source[]) => CategoryTotal}
 */
const addContribution = total => gainCents => unadjustedGainCents => sources => ({
    value: total.value + gainCents,
    unadjustedValue: total.unadjustedValue + unadjustedGainCents,
    sources: [...total.sources, ...sources],
})

/**
 * Builds the absent-basis {@link Form8949Error} for one document — case 1 of
 * the refusal order (see module docstring). Extracted to its own named
 * function (rather than inlined at the one call site) so Task 2's Mutation
 * Gate M1 has a single, unambiguous line to mutate and a single, unambiguous
 * line to revert.
 * @type {(documentHash: string) => Form8949Error}
 */
const absentBasisRefusal = documentHash => ({
    kind: 'error',
    message: `Form 8949: document ${documentHash} has box1dProceeds present but `
        + `box1eCostOrOtherBasis is genuinely absent (not reported at all — distinct `
        + `from a basis reported as zero). No gain can be honestly computed for this `
        + `document. Store a vnd.fjs.basis_correction naming this document's hash to `
        + `supply the correct basis, which the printed instructions require in column `
        + `(e) for a noncovered security whose basis is not shown.`,
})

/**
 * One code's row in {@link adjustmentCodeDispositions}, looked up by letter.
 * Used by the two refusals below so each names the SAME reason the disposition
 * table carries — one rule, one place, rather than a refusal message and a
 * table row free to drift into disagreeing about why a code is refused.
 * @type {(code: string) => string}
 */
const dispositionReason = code => {
    const entry = adjustmentCodeDispositions.find(candidate => candidate.code === code)
    assert(entry !== undefined, ['no disposition for printed adjustment code', code])
    return entry === undefined ? '' : entry.reason
}

/**
 * The refusal a stored Form 3922 forces on any return that also reports a
 * sale. Built as its own named function, like {@link absentBasisRefusal}, so
 * the three missing facts are stated once.
 *
 * A Form 3922 is issued in the year the shares are TRANSFERRED, which is
 * usually the purchase year and frequently years before any sale. In a year
 * with no sale there is nothing to report and this refusal never fires — the
 * control that keeps it from being an outage for every ESPP participant. In a
 * year WITH a sale, three separate things are missing and any one of them
 * alone would be enough:
 *
 * 1. **Which sale.** Nothing on either form establishes that the shares sold
 *    were these shares. Matching by CUSIP cannot distinguish two lots.
 * 2. **Qualifying or disqualifying.** §423(a)(1)'s holding period is more than
 *    two years from grant and more than one year from exercise, measured
 *    against the sale date. That is date arithmetic over Form 3922 boxes 1, 2
 *    and 7 and Form 1099-B box 1c, and this project has no date primitive.
 * 3. **Whether the ordinary-income element is already in Form W-2 box 1.** An
 *    employer is not required to withhold on it and many do not report it, so
 *    the wage figure this engine reads may or may not already include it —
 *    and the two answers differ by the whole compensation element.
 * @type {(documentHash: string) => Form8949Error}
 */
const employeeStockPurchaseRefusal = documentHash => ({
    kind: 'error',
    message: `Form 8949: this return stores Form 3922 ${documentHash} (an employee stock `
        + `purchase plan transfer under §423(c)) AND reports at least one sale on a Form `
        + `1099-B, and this engine cannot honestly compute either the gain or the wages. `
        + `Three facts are missing: which of the reported sales, if any, disposed of these `
        + `shares (no field on either form establishes it); whether that disposition is `
        + `qualifying or disqualifying under §423(a)(1), which is date arithmetic over Form `
        + `3922 boxes 1, 2 and 7 against Form 1099-B box 1c and this project has no date `
        + `primitive; and whether the ordinary-income element is already inside Form W-2 box `
        + `1, which an employer is not required to report. Refusing rather than computing a `
        + `gain that may be wrong by the whole compensation element.`,
})

/**
 * Computes Form 8949 rows and category totals for one return from stored
 * `vnd.fjs.1099b` documents and the taxpayer's own basis corrections.
 *
 * Walks each document once, in order, applying the refusal checks in the
 * fixed order documented above the module's "Refusal check order" section,
 * and short-circuits to the FIRST `Form8949Error` any document produces. A
 * document with `box1dProceeds` entirely undefined records no sale on this
 * document at all — DOC-11's "absent is absent, never zero," applied at the
 * whole-document granularity — and contributes nothing, without being
 * checked against any of the three refusal conditions: there is nothing to
 * refuse when there is no transaction to categorize.
 *
 * **The correction checks run BEFORE the per-document walk**, and the order
 * matters: an unmatched or duplicated correction is a fact about the whole
 * input set rather than about one document, and running it second would let a
 * per-document refusal fire first and hide the fact that the taxpayer's
 * assertion was never going to be used at all.
 * @type {(input: Form8949Inputs) => Form8949Outcome}
 */
export const form8949 = input => {
    const { brokerageForms, basisCorrections, employeeStockPurchaseForms } = input

    // ── Whole-input checks, before any document is walked ────────────────

    // A stored Form 3922 plus ANY reported sale: refuse. `some` over
    // `box1dProceeds` is the same "is there a sale at all" question the
    // per-document walk asks with `continue`, asked once up front.
    const [firstEspp] = employeeStockPurchaseForms
    if (firstEspp !== undefined
        && brokerageForms.some(form => form.value.box1dProceeds !== undefined)) {
        return employeeStockPurchaseRefusal(firstEspp.documentHash)
    }

    // A correction naming a document that is not here, or naming one twice.
    // Both are refusals rather than silent drops: an assertion the engine
    // ignores is worse than one it refuses, because the return then looks
    // computed.
    for (const correction of basisCorrections) {
        const target = correction.value.brokerageDocumentHash
        const matches = brokerageForms.filter(form => form.documentHash === target)
        if (matches.length === 0) {
            return {
                kind: 'error',
                message: `Form 8949: basis correction ${correction.documentHash} names brokerage `
                    + `document ${target}, which is not among the Forms 1099-B supplied for this `
                    + `return. Refusing rather than silently ignoring the taxpayer's assertion — `
                    + `a correction that is dropped leaves the return looking computed while the `
                    + `basis it was meant to fix is still the broker's.`,
            }
        }
        const forSameDocument = basisCorrections.filter(
            candidate => candidate.value.brokerageDocumentHash === target)
        if (forSameDocument.length > 1) {
            return {
                kind: 'error',
                message: `Form 8949: ${forSameDocument.length} basis corrections name brokerage `
                    + `document ${target}. One sale has one correct basis; this engine will not `
                    + `choose between two assertions about it.`,
            }
        }
    }

    let categoryA = emptyCategoryTotal
    let categoryB = emptyCategoryTotal
    let categoryD = emptyCategoryTotal
    let categoryE = emptyCategoryTotal
    /** @type {Form8949Row[]} */
    const rows = []

    for (const document of brokerageForms) {
        const box = document.value
        const correction = basisCorrections.find(
            candidate => candidate.value.brokerageDocumentHash === document.documentHash)
        const proceeds = box.box1dProceeds
        if (proceeds === undefined) {
            // Control case: no sale recorded on this document. Contributes
            // nothing, and is not subject to ANY of the three refusal
            // checks below — there is no transaction here to refuse.
            //
            // …unless the taxpayer corrected its basis, in which case the
            // correction can never be applied and saying nothing would be the
            // silent drop the whole-input check above exists to prevent.
            if (correction !== undefined) {
                return {
                    kind: 'error',
                    message: `Form 8949: basis correction ${correction.documentHash} names `
                        + `brokerage document ${document.documentHash}, which reports no sale at `
                        + `all (box1dProceeds is absent). There is no Form 8949 row for the `
                        + `correction to land on.`,
                }
            }
            continue
        }

        // Case 2 (Decision 1.4): box 1f or box 1g present, checked BEFORE
        // the absent-basis check, per the documented order. Each names the
        // column (f) code it would have to emit and reads its reason off
        // `adjustmentCodeDispositions` rather than restating it.
        if (box.box1fAccruedMarketDiscount !== undefined) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} carries `
                    + `box1fAccruedMarketDiscount, which requires column (f) code D — `
                    + `${dispositionReason('D')}`,
            }
        }
        if (box.box1gWashSaleLossDisallowed !== undefined) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} carries `
                    + `box1gWashSaleLossDisallowed, which requires column (f) code W — `
                    + `${dispositionReason('W')}`,
            }
        }

        // Case 1 (Decision 2.6): absent basis. THIS is Mutation Gate M1's
        // target line. As of TAX-34 a stored basis correction supplies the
        // basis instead, which is exactly what the printed instructions
        // require for a noncovered security: "For noncovered securities,
        // enter the correct basis of the property in column (e) if: No basis
        // is shown on Form 1099-B."
        const reportedBasis = box.box1eCostOrOtherBasis
        if (reportedBasis === undefined && correction === undefined) {
            return absentBasisRefusal(document.documentHash)
        }
        // A broker that checked box 12 ("basis reported to the IRS") while
        // printing no basis contradicts itself, and the contradiction decides
        // which of the two column (e)/(g) presentations applies. Refused
        // rather than resolved: this was already refused before TAX-34, by the
        // absent-basis check above, and a correction must not quietly make it
        // computable.
        if (reportedBasis === undefined && box.box12BasisReportedToIrs === true) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} checks `
                    + `box12BasisReportedToIrs while box1eCostOrOtherBasis is absent — the broker `
                    + `claims to have reported a basis it did not print. Which of the two printed `
                    + `column (e)/(g) presentations of a basis correction applies turns on exactly `
                    + `that checkbox, so this engine refuses rather than choosing one.`,
            }
        }

        // Case 3: undecided category (neither/both holding-period boxes, or
        // ordinary income).
        const category = categorize(document)
        if (category === undefined) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} cannot be `
                    + `categorized — either box2Ordinary is set (ordinary income, not `
                    + `a capital transaction) or neither box2ShortTermGainOrLoss nor `
                    + `box2LongTermGainOrLoss is set (the broker did not report a `
                    + `holding period, and this dialect has no "use your own records" `
                    + `fallback).`,
            }
        }

        // ── Columns (d), (e), (f), (g), (h) ──────────────────────────────
        const proceedsCents = centsFromString(proceeds)
        const reportedBasisCents = reportedBasis === undefined
            ? undefined
            : centsFromString(reportedBasis)
        const correctedBasisCents = correction === undefined
            ? undefined
            : centsFromString(correction.value.correctedCostOrOtherBasis)
        // The printed worksheet's own selector: was the basis reported to the
        // IRS? That is Form 8949 Part I box A / Part II box D, i.e. this
        // module's category A or D.
        const basisWasReportedToIrs = category === 'A' || category === 'D'
        // Code B applies only where a basis was SHOWN and the correction
        // disagrees with it. A correction that agrees is not "the basis shown
        // is incorrect", and an absent box 1e shows no basis to be incorrect
        // about — for that one the printed instruction is column (e) alone,
        // with no code at all.
        const codeBApplies = correctedBasisCents !== undefined
            && reportedBasisCents !== undefined
            && correctedBasisCents !== reportedBasisCents
        /** @type {readonly EmittedCode[]} */
        const codes = codeBApplies ? ['B'] : []
        //
        // The `assertNotNullish` on the else branch is unreachable and says
        // so: an absent reported basis with no correction was refused above,
        // and an absent one WITH a correction takes the first branch. A `?? 0n`
        // there would have been a silent default standing exactly where DOC-07
        // says absence must never become zero.
        const columnEBasis = correctedBasisCents !== undefined
            && (reportedBasisCents === undefined || !basisWasReportedToIrs)
            ? correctedBasisCents
            : assertNotNullish(
                reportedBasisCents,
                ['an absent basis with no correction is refused above', document.documentHash])
        // The worksheet's lines 3 and 4 in one expression: `reported − correct`,
        // negative (in parentheses on the printed form) when the correct basis
        // is the larger. Zero in every other case, including the category B/E
        // presentation, where the correction went into column (e) instead.
        const columnGAdjustment = codeBApplies && basisWasReportedToIrs
            && correctedBasisCents !== undefined && reportedBasisCents !== undefined
            ? reportedBasisCents - correctedBasisCents
            : 0n
        const columnHGain = proceedsCents - columnEBasis + columnGAdjustment
        // What the return would have said with no correction at all. For a row
        // whose box 1e was genuinely absent there is no such figure — the
        // alternative was a refusal, not a wrong number — so the row prices no
        // overstatement and `unadjustedValue` equals `value`.
        const unadjustedGainCents = reportedBasisCents === undefined
            ? columnHGain
            : proceedsCents - reportedBasisCents

        /** @type {Source[]} */
        const sources = [
            { documentHash: document.documentHash, boxPath: 'box1dProceeds', value: proceeds },
        ]
        if (reportedBasis !== undefined) {
            sources.push({
                documentHash: document.documentHash,
                boxPath: 'box1eCostOrOtherBasis',
                value: reportedBasis,
            })
        }
        if (correction !== undefined) {
            sources.push({
                documentHash: correction.documentHash,
                boxPath: 'correctedCostOrOtherBasis',
                value: correction.value.correctedCostOrOtherBasis,
            })
        }

        rows.push({
            documentHash: document.documentHash,
            category,
            columnA: box.box1aDescriptionOfProperty ?? '',
            columnDProceeds: proceedsCents,
            columnEBasis,
            columnFCode: columnFCode(codes),
            columnGAdjustment,
            columnHGain,
        })

        switch (category) {
            case 'A':
                categoryA = addContribution(categoryA)(columnHGain)(unadjustedGainCents)(sources)
                break
            case 'B':
                categoryB = addContribution(categoryB)(columnHGain)(unadjustedGainCents)(sources)
                break
            case 'D':
                categoryD = addContribution(categoryD)(columnHGain)(unadjustedGainCents)(sources)
                break
            case 'E':
                categoryE = addContribution(categoryE)(columnHGain)(unadjustedGainCents)(sources)
                break
        }
    }

    return { kind: 'ok', categoryA, categoryB, categoryD, categoryE, rows }
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The literal `sourceArtifactHash` `fjs/document/1099b`'s own fixtures use —
 * reused here rather than a fresh literal, so this module's fixtures are
 * visibly drawn from the same convention.
 * @type {string}
 */
const sharedSourceArtifactHash = 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900'

/**
 * A minimal, always-valid `vnd.fjs.1099b` base, matching
 * `fjs/document/1099b`'s own `minimal` fixture shape. Every leaf below
 * spreads this and overrides only the fields it needs.
 * @type {OneZeroNineNineB}
 */
const minimalOneZeroNineNineB = {
    dialect: 'vnd.fjs.1099b',
    payerTin: '11-1111111',
    recipientTin: '222-22-2222',
    accountNumber: 'ACC-0001',
    taxYear: 2025,
    formRevision: '2025',
    sourceArtifactHash: sharedSourceArtifactHash,
}

/**
 * Builds a `Stored<OneZeroNineNineB>` fixture, spreading {@link
 * minimalOneZeroNineNineB} and the given overrides, addressed at the given
 * document hash.
 * @type {(hash: string) => (overrides: Partial<OneZeroNineNineB>) => Stored<OneZeroNineNineB>}
 */
const brokerageForm = hash => overrides => ({
    documentHash: hash,
    value: { ...minimalOneZeroNineNineB, ...overrides },
})

/**
 * The absent-basis fixture named in this module's docstring and reused
 * verbatim by Task 2's Mutation Gate M1: `box5NoncoveredSecurity: true`,
 * `box1eCostOrOtherBasis` genuinely OMITTED (never `'0.00'`),
 * `box1dProceeds: '10000.00'`. Built once, here, so the mutation gate
 * references the SAME fixture this task's own proof already exercises,
 * rather than a second, possibly-drifted copy.
 * @type {Stored<OneZeroNineNineB>}
 */
const absentBasisFixture = brokerageForm('doc-absent-basis')({
    box5NoncoveredSecurity: true,
    box1dProceeds: '10000.00',
    box2LongTermGainOrLoss: true,
    // box1eCostOrOtherBasis genuinely OMITTED — not '0.00'.
})

/**
 * The TAX-11 shape of this module's input, as every pre-Phase-29 leaf below
 * uses it: brokerage forms alone, no basis corrections, no Form 3922.
 *
 * Introduced because {@link form8949} took a bare document list until Phase 29
 * and now takes {@link Form8949Inputs}. Written as a helper rather than by
 * spreading a shared `noEquityCompensation` base at fourteen call sites,
 * because the two new lists must be visibly EMPTY at each of those sites: the
 * whole claim those leaves make is that a return with no corrections computes
 * exactly what it computed before, and a spread would hide which fixtures are
 * making that claim.
 * @type {(brokerageForms: readonly Stored<OneZeroNineNineB>[]) => Form8949Inputs}
 */
const over = brokerageForms => ({
    brokerageForms,
    basisCorrections: [],
    employeeStockPurchaseForms: [],
})

/**
 * Builds a `Stored<BasisCorrection>` fixture naming a brokerage document by
 * hash. The `reason` is a real sentence rather than a placeholder, because
 * `vnd.fjs.basis_correction` requires one and a fixture that could not pass
 * that dialect's own `validate` would be testing a shape no stored document
 * can have.
 * @type {(hash: string) => (brokerageDocumentHash: string) => (correctedCostOrOtherBasis: string) => Stored<BasisCorrection>}
 */
const basisCorrection = hash => brokerageDocumentHash => correctedCostOrOtherBasis => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.basis_correction',
        recipientTin: '222-22-2222',
        taxYear: 2025,
        brokerageDocumentHash,
        correctedCostOrOtherBasis,
        reason: 'RSU vesting value already included in Form W-2 box 1',
    },
})

/**
 * A minimal, always-valid `vnd.fjs.form3922`, for the one leaf that needs a
 * stored employee stock purchase plan transfer and its control.
 * @type {Stored<FormThirtyNineTwentyTwo>}
 */
const employeeStockPurchaseForm = {
    documentHash: 'doc-espp',
    value: {
        dialect: 'vnd.fjs.form3922',
        corporationTin: '11-1111111',
        employeeTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: 'April 2025',
        sourceArtifactHash: sharedSourceArtifactHash,
        box3FairMarketValuePerShareOnGrantDate: '100.00',
        box4FairMarketValuePerShareOnExerciseDate: '150.00',
        box5ExercisePricePaidPerShare: '85.00',
        box6NumberOfSharesTransferred: '100',
    },
}

/**
 * Unwraps a `Form8949Ok`, throwing the whole outcome if it was an error —
 * `fjs/schedule/d`'s own `expectOk` idiom, so a leaf below can read `.rows`
 * directly rather than re-narrowing at every call site.
 * @type {(outcome: Form8949Outcome) => Form8949Ok}
 */
const expectOk = outcome => {
    assert(outcome.kind === 'ok', ['expected ok', outcome])
    return outcome
}

/**
 * The single row of a one-document outcome, narrowed. `noUncheckedIndexedAccess`
 * makes `rows[0]` a `Form8949Row | undefined`, and AGENTS.md bans the `!`.
 * @type {(outcome: Form8949Outcome) => Form8949Row}
 */
const onlyRow = outcome => {
    const ok = expectOk(outcome)
    assertEq(ok.rows.length, 1, ['expected exactly one Form 8949 row', ok.rows])
    return assertNotNullish(ok.rows[0], 'expected exactly one row')
}

export const proof = {
    // Acceptance criterion: a Category A document and an independent
    // Category E document each contribute correctly, and the two untouched
    // categories (B, D) stay at zero with empty sources.
    categorization: {
        categoryAAndCategoryEIndependentlyComputeAndOtherCategoriesStayEmpty: () => {
            const categoryADoc = brokerageForm('doc-a')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const categoryEDoc = brokerageForm('doc-e')({
                box1dProceeds: '9000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2LongTermGainOrLoss: true,
                // box12BasisReportedToIrs NOT checked -> Category E.
            })
            const outcome = form8949(over([categoryADoc, categoryEDoc]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryA.value, 200000n, 'Category A: $5,000.00 - $3,000.00 = $2,000.00')
            assertEq(outcome.categoryA.sources.length, 2)
            assertEq(outcome.categoryE.value, 500000n, 'Category E: $9,000.00 - $4,000.00 = $5,000.00')
            assertEq(outcome.categoryE.sources.length, 2)
            assertEq(outcome.categoryB.value, 0n)
            assertEq(outcome.categoryB.sources.length, 0)
            assertEq(outcome.categoryD.value, 0n)
            assertEq(outcome.categoryD.sources.length, 0)
        },
        // Category B: short-term, basis NOT reported to the IRS.
        categoryBComputesWhenShortTermAndBasisNotReported: () => {
            const doc = brokerageForm('doc-b')({
                box1dProceeds: '2000.00',
                box1eCostOrOtherBasis: '1500.00',
                box2ShortTermGainOrLoss: true,
                // box12BasisReportedToIrs NOT checked -> Category B.
            })
            const outcome = form8949(over([doc]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryB.value, 50000n, '$2,000.00 - $1,500.00 = $500.00')
        },
        // Category D: long-term, basis reported to the IRS.
        categoryDComputesWhenLongTermAndBasisReported: () => {
            const doc = brokerageForm('doc-d')({
                box1dProceeds: '20000.00',
                box1eCostOrOtherBasis: '12000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949(over([doc]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryD.value, 800000n, '$20,000.00 - $12,000.00 = $8,000.00')
        },
        // A loss (basis exceeds proceeds) must accumulate as a NEGATIVE
        // value, not be floored at zero — Form 8949 categories carry signed
        // gain/loss, not a one-directional gain.
        aLossAccumulatesAsNegativeValue: () => {
            const doc = brokerageForm('doc-loss')({
                box1dProceeds: '1000.00',
                box1eCostOrOtherBasis: '4000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949(over([doc]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryA.value, -300000n, '$1,000.00 - $4,000.00 = -$3,000.00')
        },
        // Multiple documents landing in the SAME category sum correctly, and
        // sources accumulate one entry-pair per contributing document.
        multipleDocumentsInSameCategorySumAndCiteEachDocument: () => {
            const docOne = brokerageForm('doc-multi-1')({
                box1dProceeds: '1000.00',
                box1eCostOrOtherBasis: '600.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const docTwo = brokerageForm('doc-multi-2')({
                box1dProceeds: '2000.00',
                box1eCostOrOtherBasis: '500.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949(over([docOne, docTwo]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryA.value, 190000n, '$400.00 + $1,500.00 = $1,900.00')
            assertEq(outcome.categoryA.sources.length, 4)
            assertEq(outcome.categoryA.sources[0]?.documentHash, 'doc-multi-1')
            assertEq(outcome.categoryA.sources[2]?.documentHash, 'doc-multi-2')
        },
    },
    // Acceptance criterion: the absent-basis fixture returns an error, never
    // a computed $10,000.00 gain. This is Mutation Gate M1's control leaf —
    // it must be green today and reddened only by Task 2's deliberate
    // mutation.
    absentBasisRefusal: {
        genuinelyAbsentBasisRefusesRatherThanComputingAGain: () => {
            const outcome = form8949(over([absentBasisFixture]))
            assertEq(outcome.kind, 'error', ['expected a refusal, not a computed gain', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('doc-absent-basis'),
                ['expected the refusal to name the document', outcome.message],
            )
            assert(
                outcome.message.includes('box1eCostOrOtherBasis'),
                ['expected the refusal to name the absent box', outcome.message],
            )
        },
        // Control: the SAME shape, but with basis genuinely present, must
        // compute a real gain rather than refuse — a refusal-only gate that
        // never shows the legitimate case passing proves nothing (AGENTS.md,
        // "a gate needs a control").
        presentBasisOnTheSameShapeComputesRatherThanRefusing: () => {
            const withBasis = brokerageForm('doc-with-basis')({
                box5NoncoveredSecurity: true,
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box2LongTermGainOrLoss: true,
            })
            const outcome = form8949(over([withBasis]))
            assert(outcome.kind === 'ok', ['expected ok when basis is present', outcome])
            assertEq(outcome.categoryE.value, 400000n, '$10,000.00 - $6,000.00 = $4,000.00')
        },
    },
    // Acceptance criterion: box 1f present (basis and proceeds otherwise
    // valid) refuses.
    adjustmentBoxRefusal: {
        box1fPresentRefuses: () => {
            const doc = brokerageForm('doc-1f')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box1fAccruedMarketDiscount: '50.00',
                box2LongTermGainOrLoss: true,
            })
            const outcome = form8949(over([doc]))
            assertEq(outcome.kind, 'error', ['expected a refusal when box1f is present', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('box1fAccruedMarketDiscount'),
                ['expected the refusal to name box1f', outcome.message],
            )
        },
        box1gPresentRefuses: () => {
            const doc = brokerageForm('doc-1g')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box1gWashSaleLossDisallowed: '25.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949(over([doc]))
            assertEq(outcome.kind, 'error', ['expected a refusal when box1g is present', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('box1gWashSaleLossDisallowed'),
                ['expected the refusal to name box1g', outcome.message],
            )
        },
    },
    // Acceptance criterion: undecided holding period, and ordinary income,
    // both refuse.
    undecidedCategoryRefusal: {
        neitherShortNorLongTermSetRefuses: () => {
            const doc = brokerageForm('doc-undecided')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                // Neither box2ShortTermGainOrLoss nor box2LongTermGainOrLoss set.
            })
            const outcome = form8949(over([doc]))
            assertEq(outcome.kind, 'error', ['expected a refusal when holding period is undecided', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes(doc.documentHash),
                ['expected the refusal to name the document', outcome.message],
            )
        },
        box2OrdinaryRefuses: () => {
            const doc = brokerageForm('doc-ordinary')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box2Ordinary: true,
            })
            const outcome = form8949(over([doc]))
            assertEq(outcome.kind, 'error', ['expected a refusal when box2Ordinary is set', outcome])
        },
        // Regression: box2Ordinary must dominate even when a holding-period
        // box is ALSO set (a shape no real 1099-B should print, but
        // structurally possible under this dialect's independent-checkbox
        // modeling — see categorize's own docstring). If this check ever
        // gets reordered after the short/long-term checks, this leaf must
        // catch it: without it, this exact shape would silently compute a
        // capital gain for income the payer marked ordinary.
        box2OrdinaryDominatesEvenWhenAHoldingPeriodBoxIsAlsoSet: () => {
            const doc = brokerageForm('doc-ordinary-plus-short-term')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '6000.00',
                box2Ordinary: true,
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949(over([doc]))
            assertEq(
                outcome.kind,
                'error',
                ['expected box2Ordinary to force a refusal even with box2ShortTermGainOrLoss also set', outcome],
            )
        },
    },
    // Acceptance criterion (the control case): a document with
    // box1dProceeds entirely undefined contributes to no category and does
    // NOT trigger a refusal — even when other fields, taken alone, would
    // otherwise look refusal-shaped (here: neither holding-period box set).
    noSaleRecordedContributesNothingAndIsNotRefused: () => {
        const noSaleDoc = brokerageForm('doc-no-sale')({
            // box1dProceeds entirely absent -- no sale recorded on this
            // document at all. box2Ordinary/holding-period boxes also
            // absent, which WOULD be case 3's refusal shape if this document
            // had a sale -- proving the skip happens before any refusal
            // check, not merely that this particular refusal shape is
            // absent.
        })
        const realDoc = brokerageForm('doc-real-sale')({
            box1dProceeds: '1000.00',
            box1eCostOrOtherBasis: '400.00',
            box2ShortTermGainOrLoss: true,
            box12BasisReportedToIrs: true,
        })
        const outcome = form8949(over([noSaleDoc, realDoc]))
        assert(outcome.kind === 'ok', ['expected ok — the no-sale document must not trigger a refusal', outcome])
        assertEq(outcome.categoryA.value, 60000n, 'only the real sale contributes: $1,000.00 - $400.00 = $600.00')
        assertEq(outcome.categoryA.sources.length, 2, 'the no-sale document cites nothing')
    },
    // Acceptance criterion (the cross-check, PROOF-ONLY): the derived
    // category agrees with the payer-printed applicableCheckboxOnForm8949
    // when present. Production code (`categorize`, `form8949`) never reads
    // this field — see module docstring. A second fixture where the two
    // DISAGREE is documented, not implemented as a runtime gate: disagreement
    // here would be drift the derivation itself would show up as a WRONG
    // category, not a case this module's own logic needs to detect at
    // runtime.
    crossCheckAgainstPayerPrintedLetter: {
        derivedCategoryAgreesWithApplicableCheckboxWhenPresent: () => {
            const doc = brokerageForm('doc-cross-check')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
                applicableCheckboxOnForm8949: 'A',
            })
            const derivedCategory = categorize(doc)
            assertEq(
                derivedCategory,
                'A',
                ['expected the derived category to agree with the payer-printed letter', derivedCategory],
            )
            // The engine's own computation reaches the same category
            // independently of the payer's letter — it is read here only by
            // this proof, never by form8949 itself.
            const outcome = form8949(over([doc]))
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            assertEq(outcome.categoryA.value, 200000n)
        },
        // Documented, not asserted as a runtime refusal: a fixture where
        // applicableCheckboxOnForm8949 says 'B' but the derived boxes say
        // Category A. The engine still computes Category A — this is the
        // "drift the derivation would show" 12.1-CONTEXT.md Decision 2.4
        // describes, visible here only because a proof chose to read the
        // stored letter and compare it, not because form8949 checked it.
        payerLetterDisagreementIsVisibleToAProofNotToProductionCode: () => {
            const doc = brokerageForm('doc-disagreement')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
                applicableCheckboxOnForm8949: 'B', // disagrees with the derived 'A'
            })
            const derivedCategory = categorize(doc)
            assertEq(derivedCategory, 'A')
            assert(
                derivedCategory !== doc.value.applicableCheckboxOnForm8949,
                'this fixture is deliberately constructed so the derived category and the payer letter disagree',
            )
        },
    },
    // ── TAX-34 (Phase 29): columns (f) and (g) ───────────────────────────
    adjustmentCodeVocabulary: {
        // The hand-typed count, against the eighteen codes the printed table
        // defines. Deliberately NOT `adjustmentCodes.length`, which is the
        // thing under test.
        thePrintedTableHasEighteenCodes: () => {
            assertEq(adjustmentCodes.length, expectedAdjustmentCodeCount)
            assertEq(new Set(adjustmentCodes).size, expectedAdjustmentCodeCount, 'no code twice')
        },
        // TOTALITY, and it is asserted in the direction that can catch a gap:
        // the loop walks the VOCABULARY and looks each code up in the
        // disposition table, never the reverse. A table walk could not notice
        // a code with no row, because it would simply visit one row fewer.
        everyPrintedCodeHasExactlyOneDisposition: () => {
            for (const code of adjustmentCodes) {
                const rows = adjustmentCodeDispositions.filter(entry => entry.code === code)
                assertEq(rows.length, 1, ['every printed code needs exactly one disposition', code])
                const row = assertNotNullish(rows[0], code)
                assert(row.reason.length > 0, ['a disposition with no reason says nothing', code])
            }
            // …and no disposition names a code the printed table does not
            // carry, which is the other direction and catches a typo'd letter.
            for (const entry of adjustmentCodeDispositions) {
                assert(
                    adjustmentCodes.includes(entry.code),
                    ['a disposition names a code the printed table does not define', entry.code])
            }
        },
        // Exactly one code is EMITTED, and it is B. Hand-typed rather than
        // filtered-and-counted only, so a second code quietly acquiring the
        // 'emitted' disposition without any code to emit it reddens here.
        exactlyOneCodeIsEmittedAndItIsB: () => {
            const emitted = adjustmentCodeDispositions.filter(e => e.disposition === 'emitted')
            assertEq(emitted.length, 1)
            assertEq(assertNotNullish(emitted[0], 'expected one emitted code').code, 'B')
            const refused = adjustmentCodeDispositions.filter(e => e.disposition === 'refused')
            assertEq(refused.length, 2, 'codes D and W are refused, by name')
            assertEq(refused.map(e => e.code).join(''), 'DW')
            assertEq(
                adjustmentCodeDispositions.filter(e => e.disposition === 'unreachable').length,
                15,
                'the remaining fifteen are structurally unreachable')
        },
        // The table's own order is the PRINTED order, which puts O last, out
        // of alphabetical sequence. Pinned because `columnFCode` sorts and the
        // two rules would otherwise be indistinguishable — and because a
        // "helpful" sort of this list would silently destroy the record of
        // what the page actually says.
        theVocabularyIsInThePrintedTablesOrderNotAlphabetical: () => {
            assertEq(adjustmentCodes[0], 'B', 'the table starts at B; there is no code A')
            assertEq(
                adjustmentCodes[adjustmentCodes.length - 1], 'O',
                'the catch-all is printed LAST, after Z')
            const alphabetical = [...adjustmentCodes].sort().join('')
            assert(
                adjustmentCodes.join('') !== alphabetical,
                ['the printed order must differ from the alphabetical one', adjustmentCodes.join('')])
        },
        // The emission rule the instructions state: alphabetical, no
        // separator. Exercised directly on `columnFCode` because only one code
        // is emitted today and no fixture can produce two — this is the leaf
        // that keeps the rule true for the day a second one is.
        theCodesAreEmittedInAlphabeticalOrder: () => {
            assertEq(columnFCode([]), '', 'no adjustment leaves column (f) blank')
            assertEq(columnFCode(['B']), 'B')
        },
    },
    basisAdjustment: {
        // THE MOTIVATING CASE, and the figure this phase exists to price.
        //
        // 1,000 restricted stock units vest at $150.00. The $150,000.00 is
        // compensation, it is inside Form W-2 box 1, and tax has already been
        // withheld on it. The employee sells the same day for $150,000.00. The
        // broker reports proceeds $150,000.00 and basis $0.00 -- correctly, by
        // its own rules, because $0.00 is what the employee paid -- and checks
        // box 12, so this is category A.
        //
        // Uncorrected: a $150,000.00 short-term capital gain on income that
        // was already taxed as wages.
        //   column (d)  proceeds                              $150,000.00
        //   column (e)  basis as reported (box 12 checked)          $0.00
        //   column (f)  code                                            B
        //   column (g)  reported - correct = 0 - 150,000      ($150,000.00)
        //   column (h)  150,000 - 0 + (-150,000)                      $0.00
        theRsuDoubleTaxationIsPricedAndRemoved: () => {
            const sale = brokerageForm('doc-rsu')({
                box1aDescriptionOfProperty: '1,000 sh MEGACORP',
                box1dProceeds: '150000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949({
                brokerageForms: [sale],
                basisCorrections: [basisCorrection('doc-fix')('doc-rsu')('150000.00')],
                employeeStockPurchaseForms: [],
            })
            const row = onlyRow(outcome)
            assertEq(row.category, 'A', 'box 12 checked and short-term: category A')
            assertEq(row.columnDProceeds, 15000000n, 'column (d) = $150,000.00')
            assertEq(row.columnEBasis, 0n, 'column (e) = the basis AS REPORTED, box 12 being checked')
            assertEq(row.columnFCode, 'B', 'column (f) = B, "the basis shown in box 1e is incorrect"')
            assertEq(row.columnGAdjustment, -15000000n, 'column (g) = 0 - 150,000 = -$150,000.00')
            assertEq(row.columnHGain, 0n, 'column (h) = 150,000 - 0 + (-150,000) = $0.00')
            // THE PRICE, asserted beside the corrected figure: what this
            // return would have said with no correction at all.
            const ok = expectOk(outcome)
            assertEq(ok.categoryA.value, 0n, 'the corrected gain')
            assertEq(
                ok.categoryA.unadjustedValue, 15000000n,
                'the UNCORRECTED gain: $150,000.00 of already-taxed wages, taxed a second time')
            assertEq(
                ok.categoryA.unadjustedValue - ok.categoryA.value, 15000000n,
                'the overstatement this one document removes, in cents')
            // Provenance: the correction document is cited beside the two
            // broker boxes, so a reader can see WHOSE assertion moved the
            // number.
            const boxes = ok.categoryA.sources.map(s => s.boxPath)
            assertEq(ok.categoryA.sources.length, 3, ['proceeds, reported basis, correction', boxes])
            assert(boxes.includes('correctedCostOrOtherBasis'), ['the correction must be cited', boxes])
            assertEq(
                assertNotNullish(ok.categoryA.sources[2], 'the correction citation').documentHash,
                'doc-fix')
        },
        // THE OTHER PRESENTATION, on the SAME taxpayer fact. Box 12 unchecked
        // makes this category B, and the printed worksheet then says: enter
        // the CORRECT basis in column (e) and -0- in column (g). Same
        // $150,000.00 correction, a completely different pair of columns.
        aCategoryBSaleTakesTheCorrectionInColumnEWithZeroInColumnG: () => {
            const sale = brokerageForm('doc-rsu-b')({
                box1dProceeds: '150000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                // box12BasisReportedToIrs NOT checked -> category B.
            })
            const row = onlyRow(form8949({
                brokerageForms: [sale],
                basisCorrections: [basisCorrection('doc-fix-b')('doc-rsu-b')('150000.00')],
                employeeStockPurchaseForms: [],
            }))
            assertEq(row.category, 'B')
            assertEq(row.columnEBasis, 15000000n, 'column (e) = the CORRECT basis')
            assertEq(row.columnFCode, 'B', 'the code is still B: the basis shown is still incorrect')
            assertEq(row.columnGAdjustment, 0n, 'column (g) = -0-, per the printed worksheet')
            assertEq(row.columnHGain, 0n, 'column (h) = 150,000 - 150,000 + 0 = $0.00')
        },
        // The property that makes the two presentations one rule rather than
        // two: identical proceeds, identical reported basis, identical
        // correction, differing ONLY in box 12, reach the identical column
        // (h). If they ever disagree, one of the two branches is wrong and
        // this is the leaf that says so -- neither branch's own leaf above
        // could, since each asserts only its own columns.
        //
        // **This leaf asserted ONLY the equality until a mutation showed that
        // was not enough.** Dropping category D from the box-12 selector
        // (`category === 'A' || category === 'D'` -> `category === 'A'`) left it
        // GREEN: a category D row then took category E's presentation, the
        // correction moved from column (g) into column (e), and column (h) came
        // to the same $20,000.00 — which is precisely what an equality
        // assertion cannot see. So it now asserts the columns that DIFFER as
        // well as the total that does not, and the same mutation reddens it.
        bothPresentationsOfOneCorrectionReachTheSameGain: () => {
            /** @type {(reported: boolean) => Form8949Row} */
            const rowWith = reported => {
                const hash = reported ? 'doc-both-a' : 'doc-both-b'
                const sale = brokerageForm(hash)({
                    box1dProceeds: '90000.00',
                    box1eCostOrOtherBasis: '12000.00',
                    box2LongTermGainOrLoss: true,
                    ...(reported ? { box12BasisReportedToIrs: true } : {}),
                })
                return onlyRow(form8949({
                    brokerageForms: [sale],
                    basisCorrections: [basisCorrection(`fix-${hash}`)(hash)('70000.00')],
                    employeeStockPurchaseForms: [],
                }))
            }
            const reportedToIrs = rowWith(true)
            const notReportedToIrs = rowWith(false)
            // The categories really are the two the printed worksheet
            // distinguishes -- box 12 is the ONLY difference between the two
            // fixtures.
            assertEq(reportedToIrs.category, 'D')
            assertEq(notReportedToIrs.category, 'E')
            // The presentations DIFFER, column by column. Category D: the
            // reported basis stays in column (e) and the worksheet's
            // 12,000 - 70,000 goes in column (g).
            assertEq(reportedToIrs.columnEBasis, 1200000n, 'category D keeps the REPORTED basis')
            assertEq(reportedToIrs.columnGAdjustment, -5800000n, '12,000 - 70,000 = -$58,000.00')
            // Category E: the correct basis goes in column (e) and column (g)
            // is -0-, per the printed worksheet's first bullet.
            assertEq(notReportedToIrs.columnEBasis, 7000000n, 'category E takes the CORRECT basis')
            assertEq(notReportedToIrs.columnGAdjustment, 0n, 'and enters -0- in column (g)')
            assert(
                reportedToIrs.columnEBasis !== notReportedToIrs.columnEBasis,
                'the two presentations must put DIFFERENT numbers in column (e)')
            // …and the totals agree anyway. $90,000.00 - $70,000.00 =
            // $20,000.00, hand-computed, under both.
            assertEq(reportedToIrs.columnHGain, 2000000n)
            assertEq(notReportedToIrs.columnHGain, 2000000n)
            assertEq(
                reportedToIrs.columnHGain, notReportedToIrs.columnHGain,
                'one rule, two presentations, one answer')
        },
        // A correction that makes the basis SMALLER runs the worksheet the
        // other way: line 1 larger than line 2, so column (g) is POSITIVE and
        // the gain goes UP. The engine is not a one-directional discount.
        // $8,000.00 reported, $5,000.00 correct: column (g) = +$3,000.00.
        aCorrectionThatRaisesTheGainIsAppliedToo: () => {
            const sale = brokerageForm('doc-raise')({
                box1dProceeds: '20000.00',
                box1eCostOrOtherBasis: '8000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949({
                brokerageForms: [sale],
                basisCorrections: [basisCorrection('doc-fix-raise')('doc-raise')('5000.00')],
                employeeStockPurchaseForms: [],
            })
            const row = onlyRow(outcome)
            assertEq(row.columnGAdjustment, 300000n, 'column (g) = 8,000 - 5,000 = +$3,000.00')
            assertEq(row.columnHGain, 1500000n, 'column (h) = 20,000 - 8,000 + 3,000 = $15,000.00')
            const ok = expectOk(outcome)
            assertEq(ok.categoryD.unadjustedValue, 1200000n, 'uncorrected: $20,000 - $8,000 = $12,000')
            assert(
                ok.categoryD.value > ok.categoryD.unadjustedValue,
                'a correction may raise the gain, and this fixture does')
        },
        // A correction that AGREES with the broker emits no code and no
        // adjustment. The printed IF is "the basis shown in box 1e is
        // incorrect"; a basis that is correct is not incorrect. Without this
        // leaf a return could carry a code B row with a $0.00 adjustment,
        // which asserts to the IRS that a correct figure is wrong.
        aCorrectionThatAgreesWithTheBrokerEmitsNoCode: () => {
            const sale = brokerageForm('doc-agree')({
                box1dProceeds: '20000.00',
                box1eCostOrOtherBasis: '8000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const row = onlyRow(form8949({
                brokerageForms: [sale],
                basisCorrections: [basisCorrection('doc-fix-agree')('doc-agree')('8000.00')],
                employeeStockPurchaseForms: [],
            }))
            assertEq(row.columnFCode, '', 'no code: the basis shown is not incorrect')
            assertEq(row.columnGAdjustment, 0n)
            assertEq(row.columnHGain, 1200000n, '$20,000.00 - $8,000.00 = $12,000.00')
        },
        // THE ABSENT-BASIS CASE, now computable. i8949.pdf, Column (e): "For
        // noncovered securities, enter the correct basis of the property in
        // column (e) if: No basis is shown on Form 1099-B." No code at all --
        // there is no basis SHOWN for code B to say is incorrect -- and no
        // overstatement to price, because the alternative was a refusal rather
        // than a wrong number. This is the SAME fixture the absent-basis
        // refusal leaf uses, with a correction added and nothing else changed.
        anAbsentBasisWithACorrectionComputesWithNoCode: () => {
            const outcome = form8949({
                brokerageForms: [absentBasisFixture],
                basisCorrections: [basisCorrection('doc-fix-absent')('doc-absent-basis')('6000.00')],
                employeeStockPurchaseForms: [],
            })
            const row = onlyRow(outcome)
            assertEq(row.columnEBasis, 600000n, 'column (e) = the correct basis, $6,000.00')
            assertEq(row.columnFCode, '', 'no basis was SHOWN, so nothing is being called incorrect')
            assertEq(row.columnGAdjustment, 0n)
            assertEq(row.columnHGain, 400000n, '$10,000.00 - $6,000.00 = $4,000.00')
            const ok = expectOk(outcome)
            assertEq(
                ok.categoryE.unadjustedValue, ok.categoryE.value,
                'nothing to price: without the correction this document REFUSED, it did not compute wrong')
            // …and the control, in the same leaf: the identical fixture with
            // the correction removed still refuses.
            assertEq(form8949(over([absentBasisFixture])).kind, 'error')
        },
        // A broker that checks box 12 while printing no basis contradicts
        // itself, and the contradiction is exactly the checkbox that selects
        // which presentation applies. Refused rather than resolved -- and this
        // shape was ALREADY refused before TAX-34, by the absent-basis check,
        // so the correction must not quietly make it computable.
        anAbsentBasisWithBoxTwelveCheckedRefusesEvenWithACorrection: () => {
            const contradictory = brokerageForm('doc-contradiction')({
                box1dProceeds: '10000.00',
                box2LongTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
                // box1eCostOrOtherBasis genuinely OMITTED.
            })
            const outcome = form8949({
                brokerageForms: [contradictory],
                basisCorrections: [
                    basisCorrection('doc-fix-contradiction')('doc-contradiction')('6000.00'),
                ],
                employeeStockPurchaseForms: [],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('box12BasisReportedToIrs'),
                ['the refusal must name the contradicting checkbox', outcome.message])
            assert(
                outcome.message.includes('doc-contradiction'),
                ['the refusal must name the document', outcome.message])
        },
        // Corrections are matched BY HASH, so two sales of the same security
        // on the same day take their own corrections and neither leaks onto
        // the other. This is the property that rejected matching by CUSIP.
        twoLotsTakeTheirOwnCorrections: () => {
            const first = brokerageForm('doc-lot-1')({
                box1dProceeds: '10000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
                cusipNumber: '037833100',
            })
            const second = brokerageForm('doc-lot-2')({
                box1dProceeds: '30000.00',
                box1eCostOrOtherBasis: '0.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
                cusipNumber: '037833100',
            })
            const ok = expectOk(form8949({
                brokerageForms: [first, second],
                basisCorrections: [
                    basisCorrection('fix-1')('doc-lot-1')('9000.00'),
                    basisCorrection('fix-2')('doc-lot-2')('25000.00'),
                ],
                employeeStockPurchaseForms: [],
            }))
            assertEq(ok.rows.length, 2)
            assertEq(assertNotNullish(ok.rows[0], 'row 0').columnGAdjustment, -900000n)
            assertEq(assertNotNullish(ok.rows[1], 'row 1').columnGAdjustment, -2500000n)
            // $1,000.00 + $5,000.00 = $6,000.00, hand-added.
            assertEq(ok.categoryA.value, 600000n)
            // …and the uncorrected total, hand-added: $10,000 + $30,000.
            assertEq(ok.categoryA.unadjustedValue, 4000000n)
        },
        // THE CONTROL for the whole of TAX-34, and criterion 5's own
        // statement: a return with no corrections computes EXACTLY what it
        // computed before this phase. Same fixture as
        // `categoryAAndCategoryEIndependentlyComputeAndOtherCategoriesStay\
        // Empty` above, and both totals equal, and the rows carry blank
        // column (f) and zero column (g).
        aReturnWithNoCorrectionsIsUntouched: () => {
            const categoryADoc = brokerageForm('doc-a')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const ok = expectOk(form8949(over([categoryADoc])))
            assertEq(ok.categoryA.value, 200000n)
            assertEq(ok.categoryA.unadjustedValue, 200000n, 'nothing to price')
            const row = assertNotNullish(ok.rows[0], 'one row')
            assertEq(row.columnFCode, '', 'column (f) blank')
            assertEq(row.columnGAdjustment, 0n, 'column (g) zero')
            assertEq(row.columnHGain, row.columnDProceeds - row.columnEBasis, '(h) = (d) - (e)')
        },
    },
    // An assertion the engine cannot use is REFUSED, never dropped. Three
    // shapes, each its own leaf, because each is a different mistake a caller
    // can make and a reader needs to know which one they made.
    unusableCorrectionRefusals: {
        aCorrectionNamingNoSuppliedDocumentRefuses: () => {
            const sale = brokerageForm('doc-real')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949({
                brokerageForms: [sale],
                basisCorrections: [basisCorrection('fix-orphan')('doc-that-is-not-here')('1.00')],
                employeeStockPurchaseForms: [],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('doc-that-is-not-here'),
                ['the refusal must name the document that is missing', outcome.message])
            assert(
                outcome.message.includes('fix-orphan'),
                ['and the correction that named it', outcome.message])
        },
        twoCorrectionsForOneDocumentRefuse: () => {
            const sale = brokerageForm('doc-twice')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949({
                brokerageForms: [sale],
                basisCorrections: [
                    basisCorrection('fix-a')('doc-twice')('1000.00'),
                    basisCorrection('fix-b')('doc-twice')('2000.00'),
                ],
                employeeStockPurchaseForms: [],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('doc-twice'),
                ['the refusal must name the document two corrections fight over', outcome.message])
        },
        aCorrectionOnADocumentReportingNoSaleRefuses: () => {
            const noSale = brokerageForm('doc-no-sale')({})
            const outcome = form8949({
                brokerageForms: [noSale],
                basisCorrections: [basisCorrection('fix-no-sale')('doc-no-sale')('1000.00')],
                employeeStockPurchaseForms: [],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(
                outcome.message.includes('no sale'),
                ['the refusal must say there is no row for the correction to land on', outcome.message])
        },
    },
    // DOC-23's only reader. A stored Form 3922 plus ANY sale refuses; a
    // stored Form 3922 with NO sale computes, which is the control that keeps
    // this from being an outage for every ESPP participant in a year they did
    // not sell.
    employeeStockPurchasePlan: {
        aStoredFormThreeNineTwoTwoWithASaleRefusesNamingAllThreeGaps: () => {
            const unrelatedSale = brokerageForm('doc-unrelated')({
                box1dProceeds: '5000.00',
                box1eCostOrOtherBasis: '3000.00',
                box2ShortTermGainOrLoss: true,
                box12BasisReportedToIrs: true,
            })
            const outcome = form8949({
                brokerageForms: [unrelatedSale],
                basisCorrections: [],
                employeeStockPurchaseForms: [employeeStockPurchaseForm],
            })
            assertEq(outcome.kind, 'error', ['expected a refusal', outcome])
            if (outcome.kind !== 'error') {
                throw ['expected error', outcome]
            }
            assert(outcome.message.includes('doc-espp'), ['name the Form 3922', outcome.message])
            // Each of the three gaps asserted SEPARATELY, so erasing any one
            // reddens this leaf and says which went missing -- the discipline
            // `fjs/return/tripwire`'s own refusal leaves follow.
            assert(
                outcome.message.includes('which of the reported sales'),
                ['gap 1: the shares cannot be matched', outcome.message])
            assert(
                outcome.message.includes('§423(a)(1)'),
                ['gap 2: qualifying vs disqualifying', outcome.message])
            assert(
                outcome.message.includes('Form W-2 box'),
                ['gap 3: the ordinary-income element may not be in wages', outcome.message])
        },
        // THE CONTROL, and it is the ordinary case: a Form 3922 arrives in the
        // year of PURCHASE, and in that year there is nothing to report.
        aStoredFormThreeNineTwoTwoWithNoSaleComputesSilently: () => {
            const outcome = form8949({
                brokerageForms: [],
                basisCorrections: [],
                employeeStockPurchaseForms: [employeeStockPurchaseForm],
            })
            assertEq(outcome.kind, 'ok', ['an ESPP transfer with no sale must compute', outcome])
            // …and so does a return holding a Form 1099-B that reports no sale
            // at all, since "any sale" reads box1dProceeds rather than the
            // presence of a document.
            const noSale = brokerageForm('doc-no-sale-espp')({})
            assertEq(
                form8949({
                    brokerageForms: [noSale],
                    basisCorrections: [],
                    employeeStockPurchaseForms: [employeeStockPurchaseForm],
                }).kind,
                'ok',
                'a 1099-B with no proceeds is not a sale')
        },
    },
    // The two refusals TAX-34 rewords rather than removes: each now names the
    // column (f) code it would have had to emit, and reads its reason off
    // `adjustmentCodeDispositions` so the message and the table cannot drift
    // into disagreeing.
    refusedCodesNameThemselves: () => {
        const withBox1f = brokerageForm('doc-1f-code')({
            box1dProceeds: '10000.00',
            box1eCostOrOtherBasis: '6000.00',
            box1fAccruedMarketDiscount: '50.00',
            box2LongTermGainOrLoss: true,
        })
        const dOutcome = form8949(over([withBox1f]))
        assertEq(dOutcome.kind, 'error')
        if (dOutcome.kind !== 'error') {
            throw ['expected error', dOutcome]
        }
        assert(dOutcome.message.includes('code D'), ['name the code', dOutcome.message])
        assert(
            dOutcome.message.includes('interest income'),
            ['the reason a reader can act on: the other half lands on 1040 line 2b', dOutcome.message])
        assert(
            dOutcome.message.includes(dispositionReason('D')),
            ['the refusal must carry the disposition table\'s OWN reason', dOutcome.message])

        const withBox1g = brokerageForm('doc-1g-code')({
            box1dProceeds: '10000.00',
            box1eCostOrOtherBasis: '6000.00',
            box1gWashSaleLossDisallowed: '25.00',
            box2ShortTermGainOrLoss: true,
            box12BasisReportedToIrs: true,
        })
        const wOutcome = form8949(over([withBox1g]))
        assertEq(wOutcome.kind, 'error')
        if (wOutcome.kind !== 'error') {
            throw ['expected error', wOutcome]
        }
        assert(wOutcome.message.includes('code W'), ['name the code', wOutcome.message])
        assert(
            wOutcome.message.includes(dispositionReason('W')),
            ['the refusal must carry the disposition table\'s OWN reason', wOutcome.message])
    },
}
