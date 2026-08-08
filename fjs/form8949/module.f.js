/**
 * Form 8949 — TAX-11: category derivation (A/B/D/E) and per-category totals
 * over stored `vnd.fjs.1099b` documents.
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
 * away from the raw proceeds-minus-basis figure this module computes. The
 * frozen 50-kind `fjs/return/scope` vocabulary has no kind for either
 * adjustment, so a *scope* refusal is not expressible, and this phase builds
 * no adjustment-code machinery. Silently ignoring a present box 1f/1g value
 * would compute a confidently WRONG gain (12.1-CONTEXT.md Decision 1.4) —
 * the one outcome this engine exists to prevent — so instead {@link
 * form8949} refuses, gracefully, the moment either box is present on any
 * document it is asked to categorize. This is a document-data-sufficiency
 * refusal, not a scope refusal: it is built here, directly, as this
 * module's own `Form8949Error`, and does NOT call `fjs/return/scope`'s
 * `scopeRefusal` (which would require inventing a 51st kind the frozen
 * vocabulary does not have).
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
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../exact/module.f.js'

/** @import { OneZeroNineNineB } from '../document/1099b/module.f.js' */
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

// ── Output contract (Plan 12.1-03, Schedule D, builds against this) ────────

/**
 * One category's running total: the exact cents sum of `proceeds - basis`
 * over every document landing in that category, with two {@link Source}
 * entries per contributing document (`box1dProceeds`, then
 * `box1eCostOrOtherBasis`). A category with no contributing document is
 * `{ value: 0n, sources: [] }` — a PLAIN, possibly-empty array, deliberately
 * not a `ReportLine`: this is an intermediate Schedule D composes further,
 * not a line a report renders on its own.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} CategoryTotal
 */

/**
 * The four categories this project's `vnd.fjs.1099b` dialect can drive,
 * each an independent {@link CategoryTotal}.
 * @typedef {{
 *   readonly kind: 'ok',
 *   readonly categoryA: CategoryTotal,
 *   readonly categoryB: CategoryTotal,
 *   readonly categoryD: CategoryTotal,
 *   readonly categoryE: CategoryTotal,
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
const emptyCategoryTotal = { value: 0n, sources: [] }

/**
 * Adds one document's gain and its two {@link Source} entries into a
 * category's running total. The adapted shape of `fjs/schedule/b`'s
 * `addBoxSums`: that idiom adds two sums of the SAME box across documents;
 * this adds one document's contribution into the category it was just
 * classified into.
 * @type {(total: CategoryTotal) => (gainCents: bigint) => (sources: readonly Source[]) => CategoryTotal}
 */
const addContribution = total => gainCents => sources => ({
    value: total.value + gainCents,
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
        + `document.`,
})

/**
 * Computes Form 8949 category totals for one return from stored
 * `vnd.fjs.1099b` documents.
 *
 * Walks each document once, in order, applying the refusal checks in the
 * fixed order documented above the module's "Refusal check order" section,
 * and short-circuits to the FIRST `Form8949Error` any document produces. A
 * document with `box1dProceeds` entirely undefined records no sale on this
 * document at all — DOC-11's "absent is absent, never zero," applied at the
 * whole-document granularity — and contributes nothing, without being
 * checked against any of the three refusal conditions: there is nothing to
 * refuse when there is no transaction to categorize.
 * @type {(brokerageForms: readonly Stored<OneZeroNineNineB>[]) => Form8949Outcome}
 */
export const form8949 = brokerageForms => {
    let categoryA = emptyCategoryTotal
    let categoryB = emptyCategoryTotal
    let categoryD = emptyCategoryTotal
    let categoryE = emptyCategoryTotal

    for (const document of brokerageForms) {
        const box = document.value
        const proceeds = box.box1dProceeds
        if (proceeds === undefined) {
            // Control case: no sale recorded on this document. Contributes
            // nothing, and is not subject to ANY of the three refusal
            // checks below — there is no transaction here to refuse.
            continue
        }

        // Case 2 (Decision 1.4): box 1f or box 1g present, checked BEFORE
        // the absent-basis check, per the documented order.
        if (box.box1fAccruedMarketDiscount !== undefined) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} carries `
                    + `box1fAccruedMarketDiscount, which this phase has no Form 8949 `
                    + `adjustment-code mechanism to apply honestly.`,
            }
        }
        if (box.box1gWashSaleLossDisallowed !== undefined) {
            return {
                kind: 'error',
                message: `Form 8949: document ${document.documentHash} carries `
                    + `box1gWashSaleLossDisallowed, which this phase has no Form 8949 `
                    + `adjustment-code mechanism to apply honestly.`,
            }
        }

        // Case 1 (Decision 2.6): absent basis. THIS is Mutation Gate M1's
        // target line.
        const basis = box.box1eCostOrOtherBasis
        if (basis === undefined) {
            return absentBasisRefusal(document.documentHash)
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

        const gainCents = centsFromString(proceeds) - centsFromString(basis)
        /** @type {readonly Source[]} */
        const sources = [
            { documentHash: document.documentHash, boxPath: 'box1dProceeds', value: proceeds },
            { documentHash: document.documentHash, boxPath: 'box1eCostOrOtherBasis', value: basis },
        ]

        switch (category) {
            case 'A':
                categoryA = addContribution(categoryA)(gainCents)(sources)
                break
            case 'B':
                categoryB = addContribution(categoryB)(gainCents)(sources)
                break
            case 'D':
                categoryD = addContribution(categoryD)(gainCents)(sources)
                break
            case 'E':
                categoryE = addContribution(categoryE)(gainCents)(sources)
                break
        }
    }

    return { kind: 'ok', categoryA, categoryB, categoryD, categoryE }
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
            const outcome = form8949([categoryADoc, categoryEDoc])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([doc])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([doc])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([doc])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([docOne, docTwo])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([absentBasisFixture])
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
            const outcome = form8949([withBasis])
            assert(outcome.kind === 'ok', ['expected ok when basis is present', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
            const outcome = form8949([doc])
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
            const outcome = form8949([doc])
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
            const outcome = form8949([doc])
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
            const outcome = form8949([doc])
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
            const outcome = form8949([doc])
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
        const outcome = form8949([noSaleDoc, realDoc])
        assert(outcome.kind === 'ok', ['expected ok — the no-sale document must not trigger a refusal', outcome])
        if (outcome.kind !== 'ok') {
            throw ['expected ok', outcome]
        }
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
            const outcome = form8949([doc])
            assert(outcome.kind === 'ok', ['expected ok', outcome])
            if (outcome.kind !== 'ok') {
                throw ['expected ok', outcome]
            }
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
}
