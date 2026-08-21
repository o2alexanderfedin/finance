/**
 * Schedule B (Form 1040) — TAX-07: Part I (interest), Part II (ordinary
 * dividends), and Part III (the $1,500 threshold test and the
 * foreign-account/trust questions).
 *
 * Source, fetched and read directly (12-RESEARCH.md Q4), not from recall:
 * `https://www.irs.gov/pub/irs-pdf/f1040sb.pdf` — **2025 revision**, printed
 * "Schedule B (Form 1040) 2025... Created 4/23/25".
 *
 * This is a STANDALONE, independently callable pure function over stored
 * `vnd.fjs.1099int`/`vnd.fjs.1099div` documents, the three Schedule K-1
 * dialects, and the declared return profile — the same relationship
 * `fjs/tax/line16/qdcgt` had to
 * `vnd.fjs.1099div` before this phase existed. It is NOT wired into Form
 * 1040's own income-line or tax-and-payment-line aggregation, and it does
 * not consult the return-scope guard's own classification function. (Those
 * functions are named in 12-CONTEXT.md/12-RESEARCH.md and in
 * `fjs/form1040/core`/`fjs/return/scope` themselves, deliberately not
 * repeated here by name, so this file's own text cannot be mistaken for
 * evidence of a runtime import — this module's `<verify>` grep gate checks
 * for exactly those names.) It imports NOTHING at runtime from `fjs/tax/`,
 * `fjs/return/scope`, or `fjs/form1040/`.
 *
 * ## Two documented, deliberate scope boundaries
 *
 * - **Line 3 (Form 8815 excludable EE/I savings bond interest) is NOT
 *   modeled this phase** — Form 8815 does not exist in this codebase — so
 *   line 4 equals line 2 exactly. Not a silent gap: line 4 is constructed
 *   explicitly equal to line 2, with this paragraph as the record of why.
 * - **Lines 1 and 5 (the per-payer name+amount listing) ARE materialized, as
 *   of the Schedule K-1 fix below.** They were not until then, on the stated
 *   ground that each `ReportLine`'s `sources` tuple is a stronger provenance
 *   record than a bare payer-name list. That remains true of provenance and
 *   was the wrong tool for this job: a `Source` carries a document hash, not
 *   a payer IDENTITY, and "which payer name does a Schedule K-1 contribute"
 *   is precisely the question that had to be answered before a K-1 amount
 *   could enter line 2. See {@link PayerRow}.
 *
 * ## Schedule K-1 interest and dividends ARE Part I / Part II payer rows
 *
 * This is the decision `fjs/todo/schedule-b-omits-k1-interest-and-dividends.md`
 * existed to force, and it is settled by the printed page rather than by
 * preference. Three grounds, in descending order of how hard they are to
 * argue with — all read off the 2025 revision cited above and the
 * *Instructions for Schedule B*, not from recall:
 *
 * 1. **Printed line 4 says: "Subtract line 3 from line 2. Enter the result
 *    here and on Form 1040 or 1040-SR, line 2b."** Line 4 IS 1040 line 2b —
 *    the form says so on its own face. Printed line 6 says the same of line
 *    3b. A Schedule K-1's separately stated interest reaches 1040 line 2b
 *    (the partner's box 5, the shareholder's box 4, the beneficiary's box
 *    1). So if that amount were not in line 2, line 4 would NOT equal line
 *    2b and the form would contradict its own printed instruction. There is
 *    no consistent Schedule B in which a K-1 amount sits in 2b but outside
 *    line 4.
 * 2. **The line 1 instruction is "Report on line 1 all of your taxable
 *    interest", and line 5's is "all of your ordinary dividends."** Neither
 *    names a document family as its boundary. The Forms 1099-INT/1099-OID
 *    the instruction goes on to mention are examples of where the figure is
 *    usually *shown*, not a definition of what qualifies.
 * 3. **The "use Schedule B if" trigger is "over $1,500 of taxable interest
 *    or ordinary dividends"** — a property of the taxpayer's total, not of
 *    any one form. Reading it as "over $1,500 of 1099-INT interest" is what
 *    produced the gap: 1040 line 2b could cross $1,500 through a K-1 while
 *    this module's own line 4 stayed below it and Part III was silently
 *    skipped.
 *
 * **What a K-1 payer row IS: one row per K-1 DOCUMENT, named by the issuing
 * entity.** Per-document rather than per-payer-TIN, and that follows the
 * printed Note beneath Part I, which is the only place the form says how to
 * turn a *statement* into a *row*: for a Form 1099-INT or substitute
 * statement from a brokerage firm, "list the firm's name as the payer and
 * enter the total interest shown on that form." One row per form, named by
 * the entity that issued it, carrying that form's total. A Schedule K-1 is
 * the same object — a statement issued by an entity — so a partnership, an S
 * corporation or an estate/trust is listed exactly as the brokerage firm is:
 * by name, with the interest shown on its own form. `payerName` is optional
 * on every one of these dialects, so an unnamed issuer falls back to its
 * TIN with the entity kind spelled out, reusing `fjs/schedule/e`'s existing
 * `partnership <tin>` / `S corporation <tin>` / `estate or trust <tin>`
 * wording verbatim (reimplemented, not imported — that module does not
 * export it, and importing a sibling schedule would couple two deliberately
 * standalone functions).
 *
 * **The rows are what keeps the widened threshold honest.** The note this
 * closes warned that adding K-1 amounts to lines 4 and 6 *without* the
 * listing would be worse than the gap — a Schedule B whose Part I does not
 * add up to its own line 4. So that is asserted rather than intended:
 * `proof.partOne.rowsSumToLineTwoAndLineFour` and its Part II twin.
 *
 * **Which K-1 boxes, and the one that is easy to miss.** Part I takes the
 * partner's box 5, the shareholder's box 4 and the beneficiary's box 1.
 * Part II takes the partner's box 6a **and box 6c**, the shareholder's box
 * 5a and the beneficiary's box 2a. Box 6c (§871(m) dividend equivalents)
 * exists on the partnership face alone and is a genuine SECOND summand
 * rather than a slice of 6a — omit it and line 6 stops equalling 1040 line
 * 3b for any partner holding one, which is the exact internal inconsistency
 * ground 1 above forbids. The QUALIFIED boxes (the partner's 6b, the
 * shareholder's 5b, the beneficiary's 2b, and the 1099-DIV's own box 1b) are
 * deliberately absent: each is a SUBSET of its ordinary sibling and feeds
 * 1040 line 3a only, so adding one here would count the same dividend twice.
 *
 * ## The $1,500 threshold — two independent tests, never one combined test
 *
 * The printed form carries two SEPARATE Notes: "If line 4 is over $1,500,
 * you must complete Part III" (beneath Part I) and "If line 6 is over
 * $1,500, you must complete Part III" (beneath Part II). Part III's own
 * header restates this as a disjunction ("over $1,500 of taxable interest
 * **or** ordinary dividends"), not a combined sum. A taxpayer with $1,200
 * interest and $1,200 dividends (combined $2,400, neither individually over
 * $1,500) does NOT trigger Part III on the threshold grounds. Combining the
 * two into one "total over $1,500" test is the documented common error this
 * module exists to avoid — see {@link scheduleBThresholdCents}.
 *
 * ## Part III's foreign-account answers are taxpayer-DECLARED
 *
 * Read VERBATIM from `vnd.fjs.return_profile`'s four foreign-account fields
 * (added Plan 12-03) — never inferred from any transcribed 1099. No IRS
 * information return reports "do you have a foreign account."
 *
 * Follows this project's worksheet idiom (`fjs/tax/line16/qdcgt`): one named
 * pure function, printed line numbers, IRS order.
 *
 * The helpers below (`payerRows`, `totalOfRows`, `documentLine`,
 * `profileDeclaredZeroLine`) are reimplemented locally, private and NOT
 * imported from `fjs/form1040/core` — that module does not export them, and
 * this is the same "reimplement an idiom you cannot import" pattern
 * `fjs/server/finance_documents_list` already uses (11-PATTERNS.md). The
 * earlier pair `sumBoxOverDocuments`/`addBoxSums` is gone: it summed one box
 * across many documents, which is the wrong axis for a printed listing that
 * wants many boxes gathered per DOCUMENT into one row.
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { centsFromString } from '../../exact/module.f.js'

/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
/** @import { K1Partnership } from '../../document/k1_1065/module.f.js' */
/** @import { K1SCorporation } from '../../document/k1_1120s/module.f.js' */
/** @import { K1EstateTrust } from '../../document/k1_1041/module.f.js' */
/** @import { ReturnProfile } from '../../return/profile/module.f.js' */
/** @import { ReportLine, Source } from '../../report/line/module.f.js' */

// ── Inputs ───────────────────────────────────────────────────────────────────

/**
 * A stored document as this module sees it: the CAS hash it is addressed by,
 * paired with its ALREADY-VALIDATED value. Nothing here re-validates — a blob
 * that never passed its dialect's `validate` has no business reaching a
 * schedule line (mirrors `fjs/form1040/core`'s own `Stored<T>`, "nothing here
 * re-validates").
 * @template T
 * @typedef {{ readonly documentHash: string, readonly value: T }} Stored
 */

/**
 * Everything Schedule B reads: stored 1099-INT and 1099-DIV documents, the
 * three Schedule K-1 faces, and the one return profile a return has exactly
 * one of.
 *
 * The three K-1 collections are REQUIRED rather than optional, and
 * deliberately so: they were absent entirely until the fix this module's
 * docstring records, and the failure mode was a caller silently getting zero
 * K-1 interest. A required field makes the same omission a `tsc` error.
 * @typedef {{
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly partnershipK1Forms: readonly Stored<K1Partnership>[],
 *   readonly sCorporationK1Forms: readonly Stored<K1SCorporation>[],
 *   readonly estateTrustK1Forms: readonly Stored<K1EstateTrust>[],
 *   readonly profile: Stored<ReturnProfile>,
 * }} ScheduleBInputs
 */

/**
 * The exact cents sum of a set of payer rows, with every contributing
 * {@link Source} flattened out of them. `sources` is a PLAIN, possibly-empty
 * array — deliberately not a `ReportLine`; {@link documentLine} is where an
 * empty sum becomes a profile-declared zero instead.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

/**
 * ONE printed Part I line 1 (or Part II line 5) row: a payer's name and the
 * amount received from that payer. One row per stored DOCUMENT that supplied
 * at least one in-scope box — see the module docstring for why per-document
 * rather than per-TIN, and for what makes a Schedule K-1 issuer a payer at
 * all.
 *
 * `payerTin` rides alongside `payer` because the printed name is not an
 * identifier: two documents can carry the same `payerName` string, and a
 * document may carry none at all (in which case `payer` is built FROM the
 * TIN). Nothing here dedupes on either — the printed form lists statements,
 * not entities.
 * @typedef {{
 *   readonly payer: string,
 *   readonly payerTin: string,
 *   readonly value: bigint,
 *   readonly sources: readonly [Source, ...(readonly Source[])],
 * }} PayerRow
 */

/**
 * How to read ONE box off a document: the dotted `boxPath` the resulting
 * {@link Source} cites, and the accessor that yields the printed string.
 * @template T
 * @typedef {{
 *   readonly boxPath: string,
 *   readonly read: (document: T) => string | undefined,
 * }} BoxReader
 */

/**
 * Builds the payer rows one document family contributes. `identify` turns a
 * document into its printed payer name and TIN; `readers` names every box of
 * that family this part of the schedule takes.
 *
 * A document supplying NO present box produces NO row — DOC-11: an absent
 * box is ABSENT, never zero, and the printed form has no row for a payer who
 * paid nothing. That is also what keeps `sources` a non-empty tuple.
 * @type {<T>(identify: (document: T) => { readonly payer: string, readonly payerTin: string }) => (readers: readonly BoxReader<T>[]) => (documents: readonly Stored<T>[]) => readonly PayerRow[]}
 */
const payerRows = identify => readers => documents => documents.flatMap(document => {
    const sources = readers.flatMap(reader => {
        const printed = reader.read(document.value)
        return printed === undefined
            ? []
            : [{ documentHash: document.documentHash, boxPath: reader.boxPath, value: printed }]
    })
    const [first, ...rest] = sources
    if (first === undefined) {
        return []
    }
    const { payer, payerTin } = identify(document.value)
    return [{
        payer,
        payerTin,
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources: [first, ...rest],
    }]
})

/**
 * The printed total of a listing: line 2 is "Add the amounts on line 1" and
 * line 6 is "Add the amounts on line 5", so both totals are computed FROM
 * the rows rather than beside them. A row the listing does not carry cannot
 * reach the total, which is the invariant the module docstring promises.
 * @type {(rows: readonly PayerRow[]) => BoxSum}
 */
const totalOfRows = rows => ({
    value: rows.reduce((total, row) => total + row.value, 0n),
    sources: rows.flatMap(row => row.sources),
})

/**
 * A line that is zero because the taxpayer declared no such income, citing
 * the return profile's own `declaredKinds` box as its provenance.
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
 * A line whose value came from documents — falling back to
 * {@link profileDeclaredZeroLine} when NO document supplied a reading.
 * @type {(profile: Stored<ReturnProfile>) => (rule: string) => (sum: BoxSum) => ReportLine}
 */
const documentLine = profile => rule => sum => {
    const [first, ...rest] = sum.sources
    return first === undefined
        ? profileDeclaredZeroLine(profile)(rule)
        : { value: sum.value, sources: [first, ...rest], rule }
}

/**
 * $1,500.00. Cited by both of Schedule B's own printed Notes: "If line 4 is
 * over $1,500, you must complete Part III" (beneath Part I) and "If line 6
 * is over $1,500, you must complete Part III" (beneath Part II). The
 * comparison is `>`, never `>=` — "over $1,500" is strict, so a line
 * landing at exactly $1,500.00 does NOT trigger Part III on that ground
 * alone.
 * @type {bigint}
 */
export const scheduleBThresholdCents = 150000n

/**
 * Everything Schedule B produces: the Part I/II payer LISTINGS, the Part I/II
 * totals as `ReportLine`s, the two independent threshold booleans, the Part
 * III foreign-account echo, and the combined "must complete Part III" flag.
 * @typedef {{
 *   readonly line1: readonly PayerRow[],
 *   readonly line5: readonly PayerRow[],
 *   readonly line2: ReportLine,
 *   readonly line4: ReportLine,
 *   readonly line6: ReportLine,
 *   readonly interestOverThreshold: boolean,
 *   readonly dividendsOverThreshold: boolean,
 *   readonly hadForeignFinancialAccount: boolean,
 *   readonly requiredToFileFinCen114: boolean,
 *   readonly foreignAccountCountries: readonly string[] | undefined,
 *   readonly receivedForeignTrustDistributionOrWasGrantorOrTransferor: boolean,
 *   readonly partThreeRequired: boolean,
 * }} ScheduleB
 */

/**
 * Computes Schedule B for one return from stored 1099-INT/1099-DIV
 * documents and the declared return profile.
 * @type {(inputs: ScheduleBInputs) => ScheduleB}
 */
export const scheduleB = inputs => {
    const {
        interestForms, dividendForms,
        partnershipK1Forms, sCorporationK1Forms, estateTrustK1Forms,
        profile,
    } = inputs
    const fromDocuments = documentLine(profile)

    // The printed listings. Row order follows the document families in the
    // same order 1040 lines 2b and 3b take their own summands, so the two
    // can be compared row against summand rather than only total against
    // total.
    //
    // The K-1 box paths are DIALECT-QUALIFIED and the 1099s' are not, for the
    // reason `fjs/form1040/core`'s own line 2b gives: `k1_1041`'s interest
    // box is literally `box1InterestIncome`, the same field name the
    // 1099-INT uses, so an unqualified citation could not tell a
    // beneficiary's interest from a bank's — and a `boxPath` assertion is the
    // only thing that catches a transposition a sum absorbs.
    const line1 = [
        ...payerRows(
            form => ({ payer: form.payerName ?? `payer ${form.payerTin}`, payerTin: form.payerTin }))([
            { boxPath: 'box1InterestIncome', read: form => form.box1InterestIncome },
            {
                boxPath: 'box3UsSavingsBondsAndTreasuryInterest',
                read: form => form.box3UsSavingsBondsAndTreasuryInterest,
            },
        ])(interestForms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `partnership ${k1.partnershipEIN}`, payerTin: k1.partnershipEIN }))([
            { boxPath: 'k1_1065.box5InterestIncome', read: k1 => k1.box5InterestIncome },
        ])(partnershipK1Forms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `S corporation ${k1.payerTin}`, payerTin: k1.payerTin }))([
            { boxPath: 'k1_1120s.box4InterestIncome', read: k1 => k1.box4InterestIncome },
        ])(sCorporationK1Forms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `estate or trust ${k1.estateOrTrustEIN}`, payerTin: k1.estateOrTrustEIN }))([
            { boxPath: 'k1_1041.box1InterestIncome', read: k1 => k1.box1InterestIncome },
        ])(estateTrustK1Forms),
    ]

    const line5 = [
        ...payerRows(
            form => ({ payer: form.payerName ?? `payer ${form.payerTin}`, payerTin: form.payerTin }))([
            { boxPath: 'box1aTotalOrdinaryDividends', read: form => form.box1aTotalOrdinaryDividends },
        ])(dividendForms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `partnership ${k1.partnershipEIN}`, payerTin: k1.partnershipEIN }))([
            { boxPath: 'k1_1065.box6aOrdinaryDividends', read: k1 => k1.box6aOrdinaryDividends },
            // Box 6c is a SECOND partnership summand, never a slice of 6a —
            // see the module docstring. The partnership face is the only one
            // that has it.
            { boxPath: 'k1_1065.box6cDividendEquivalents', read: k1 => k1.box6cDividendEquivalents },
        ])(partnershipK1Forms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `S corporation ${k1.payerTin}`, payerTin: k1.payerTin }))([
            { boxPath: 'k1_1120s.box5aOrdinaryDividends', read: k1 => k1.box5aOrdinaryDividends },
        ])(sCorporationK1Forms),
        ...payerRows(
            k1 => ({ payer: k1.payerName ?? `estate or trust ${k1.estateOrTrustEIN}`, payerTin: k1.estateOrTrustEIN }))([
            { boxPath: 'k1_1041.box2aOrdinaryDividends', read: k1 => k1.box2aOrdinaryDividends },
        ])(estateTrustK1Forms),
    ]

    // "Add the amounts on line 1" / "Add the amounts on line 5", taken
    // literally: both totals are computed FROM the listing above.
    const line2 = fromDocuments('Schedule B line 2')(totalOfRows(line1))

    // Line 3 (Form 8815) is not modeled this phase — see module docstring —
    // so line 4 equals line 2 exactly.
    const line4 = { ...line2, rule: 'Schedule B line 4' }

    const line6 = fromDocuments('Schedule B line 6')(totalOfRows(line5))

    // TWO INDEPENDENT tests — never a combined `line4.value + line6.value`
    // sum. See module docstring, "The $1,500 threshold".
    const interestOverThreshold = line4.value > scheduleBThresholdCents
    const dividendsOverThreshold = line6.value > scheduleBThresholdCents

    const hadForeignFinancialAccount = profile.value.hadForeignFinancialAccount === true
    const requiredToFileFinCen114 = profile.value.requiredToFileFinCen114 === true
    const foreignAccountCountries = profile.value.foreignAccountCountries
    const receivedForeignTrustDistributionOrWasGrantorOrTransferor =
        profile.value.receivedForeignTrustDistributionOrWasGrantorOrTransferor === true

    const partThreeRequired = interestOverThreshold || dividendsOverThreshold
        || hadForeignFinancialAccount || receivedForeignTrustDistributionOrWasGrantorOrTransferor

    return {
        line1, line5,
        line2, line4, line6,
        interestOverThreshold, dividendsOverThreshold,
        hadForeignFinancialAccount, requiredToFileFinCen114,
        foreignAccountCountries,
        receivedForeignTrustDistributionOrWasGrantorOrTransferor,
        partThreeRequired,
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
const profileNoForeign = { documentHash: 'profile-hash-0001', value: minimalProfileValue }

/** @type {Stored<ReturnProfile>} */
const profileWithForeignAccount = {
    documentHash: 'profile-hash-0002',
    value: { ...minimalProfileValue, hadForeignFinancialAccount: true },
}

/** @type {Stored<ReturnProfile>} */
const profileWithForeignTrust = {
    documentHash: 'profile-hash-0003',
    value: {
        ...minimalProfileValue,
        receivedForeignTrustDistributionOrWasGrantorOrTransferor: true,
    },
}

/** @type {Stored<ReturnProfile>} */
const profileFullyDeclared = {
    documentHash: 'profile-hash-0004',
    value: {
        ...minimalProfileValue,
        hadForeignFinancialAccount: true,
        requiredToFileFinCen114: true,
        foreignAccountCountries: ['France', 'Germany'],
        receivedForeignTrustDistributionOrWasGrantorOrTransferor: true,
    },
}

/**
 * A minimal 1099-INT fixture. Only `box1InterestIncome`/
 * `box3UsSavingsBondsAndTreasuryInterest` vary between leaves — every other
 * field is a constant, matching `fjs/document/1099int`'s own `minimal`
 * fixture shape.
 * @type {(box1: string | undefined) => (box3: string | undefined) => (hash: string) => Stored<OneZeroNineNineInt>}
 */
const interestForm = box1 => box3 => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099int',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2024',
        ...(box1 === undefined ? {} : { box1InterestIncome: box1 }),
        ...(box3 === undefined ? {} : { box3UsSavingsBondsAndTreasuryInterest: box3 }),
    },
})

/**
 * A minimal 1099-DIV fixture, matching `fjs/document/1099div`'s own
 * `minimal` fixture shape.
 * @type {(box1a: string | undefined) => (hash: string) => Stored<OneZeroNineNineDiv>}
 */
const dividendForm = box1a => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.1099div',
        payerTin: '11-1111111',
        recipientTin: '222-22-2222',
        accountNumber: 'ACC-0001',
        taxYear: 2025,
        formRevision: '2024',
        sourceArtifactHash: 'deadbeef00112233445566778899aabbccddeeff0011223344556677889900',
        ...(box1a === undefined ? {} : { box1aTotalOrdinaryDividends: box1a }),
    },
})

/**
 * "This return holds no Schedule K-1 of any face" — spelled once and spread
 * into every leaf that is about the 1099 path, so those leaves keep reading
 * as statements about 1099s.
 * @type {Pick<ScheduleBInputs, 'partnershipK1Forms' | 'sCorporationK1Forms' | 'estateTrustK1Forms'>}
 */
const noScheduleK1s = {
    partnershipK1Forms: [],
    sCorporationK1Forms: [],
    estateTrustK1Forms: [],
}

/**
 * A partner's Schedule K-1, carrying only the boxes a leaf names. Box G is
 * ticked and `materialParticipation` supplied because `fjs/document/k1_1065`
 * refuses a document without exactly one partner type — these fixtures are
 * shaped as documents that would really store, not as the minimum this
 * module happens to read.
 * @type {(boxes: Partial<K1Partnership>) => (hash: string) => Stored<K1Partnership>}
 */
const partnershipK1 = boxes => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1065',
        partnershipEIN: '33-3333333',
        partnerTin: '222-22-2222',
        accountNumber: 'PTR-0001',
        taxYear: 2025,
        formRevision: '2025',
        boxGGeneralPartnerOrLlcMemberManager: true,
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

/** A shareholder's Schedule K-1.
 * @type {(boxes: Partial<K1SCorporation>) => (hash: string) => Stored<K1SCorporation>}
 */
const sCorporationK1 = boxes => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1120s',
        payerTin: '44-4444444',
        recipientTin: '222-22-2222',
        accountNumber: 'SHR-0001',
        taxYear: 2025,
        formRevision: '2025',
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

/** A beneficiary's Schedule K-1. This face carries no `accountNumber`.
 * @type {(boxes: Partial<K1EstateTrust>) => (hash: string) => Stored<K1EstateTrust>}
 */
const estateTrustK1 = boxes => hash => ({
    documentHash: hash,
    value: {
        dialect: 'vnd.fjs.k1_1041',
        estateOrTrustEIN: '66-6666666',
        beneficiaryIdentifyingNumber: '222-22-2222',
        taxYear: 2025,
        formRevision: '2025',
        boxHDomesticBeneficiary: true,
        materialParticipation: 'materiallyParticipated',
        ...boxes,
    },
})

export const proof = {
    // ── The printed listings, and the Schedule K-1 decision ──────────────
    //
    // Every `length` here is HAND-TYPED alongside the row it checks. A proof
    // that only walked `result.line1` would keep passing with a document
    // family silently dropped from the listing — the exact shape AGENTS.md
    // names as the subtlest of the four defects this project has shipped.
    partOne: {
        // The note's own question, answered: a K-1's separately stated
        // interest is a payer row, and the payer is the ISSUING ENTITY.
        k1InterestIsOneRowPerDocumentNamedByTheIssuingEntity: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [
                    partnershipK1({ payerName: 'Northwind Ventures LP', box5InterestIncome: '1200.00' })('k1-1065-a'),
                ],
                sCorporationK1Forms: [
                    sCorporationK1({ payerName: 'Northwind Software Inc.', box4InterestIncome: '2500.00' })('k1-1120s-a'),
                ],
                estateTrustK1Forms: [
                    estateTrustK1({ payerName: 'The Harrow Family Trust', box1InterestIncome: '3700.00' })('k1-1041-a'),
                ],
                profile: profileNoForeign,
            })
            assertEq(result.line1.length, 3, 'three K-1 documents, three Part I rows')
            assertEq(result.line1[0]?.payer, 'Northwind Ventures LP')
            assertEq(result.line1[0]?.value, 120000n)
            assertEq(result.line1[1]?.payer, 'Northwind Software Inc.')
            assertEq(result.line1[1]?.value, 250000n)
            assertEq(result.line1[2]?.payer, 'The Harrow Family Trust')
            assertEq(result.line1[2]?.value, 370000n)
        },
        // `payerName` is optional on all three faces, so the fallback names
        // the entity KIND alongside the TIN — a bare TIN on a printed Part I
        // would tell the reader nothing about what they held.
        anUnnamedIssuerFallsBackToItsTinWithTheEntityKindSpelledOut: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box5InterestIncome: '10.00' })('k1-1065-b')],
                sCorporationK1Forms: [sCorporationK1({ box4InterestIncome: '20.00' })('k1-1120s-b')],
                estateTrustK1Forms: [estateTrustK1({ box1InterestIncome: '30.00' })('k1-1041-b')],
                profile: profileNoForeign,
            })
            assertEq(result.line1.length, 3)
            assertEq(result.line1[0]?.payer, 'partnership 33-3333333')
            assertEq(result.line1[1]?.payer, 'S corporation 44-4444444')
            assertEq(result.line1[2]?.payer, 'estate or trust 66-6666666')
            // The TIN also rides alongside, because a printed name is not an
            // identifier.
            assertEq(result.line1[0]?.payerTin, '33-3333333')
            assertEq(result.line1[2]?.payerTin, '66-6666666')
        },
        // The invariant the retired note demanded before the threshold could
        // be widened at all: a Schedule B whose Part I does not add up to its
        // own line 4 would be worse than the gap it fixes.
        rowsSumToLineTwoAndLineFour: () => {
            const result = scheduleB({
                interestForms: [
                    interestForm('100.00')('50.00')('int-doc-1'),
                    interestForm('7.25')(undefined)('int-doc-2'),
                ],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box5InterestIncome: '1200.00' })('k1-1065-c')],
                sCorporationK1Forms: [sCorporationK1({ box4InterestIncome: '2500.00' })('k1-1120s-c')],
                estateTrustK1Forms: [estateTrustK1({ box1InterestIncome: '3700.00' })('k1-1041-c')],
                profile: profileNoForeign,
            })
            assertEq(result.line1.length, 5, 'two 1099-INTs and three K-1s, five Part I rows')
            // Hand-typed, not folded from the rows: $100.00 + $50.00 on the
            // first 1099-INT, $7.25 on the second, then $1,200.00 + $2,500.00
            // + $3,700.00 across the three K-1s = $7,557.25.
            assertEq(result.line2.value, 755725n)
            assertEq(result.line4.value, 755725n)
            assertEq(
                result.line1.reduce((total, row) => total + row.value, 0n),
                result.line2.value,
                'printed line 2 is "Add the amounts on line 1" — the listing must add up to it',
            )
            // A 1099-INT with both boxes present is ONE row carrying two
            // sources, not two rows: the printed Note lists a statement, not
            // a box.
            assertEq(result.line1[0]?.sources.length, 2)
            assertEq(result.line1[0]?.value, 15000n)
            // The 1099 fallback name, asserted for the same reason the K-1
            // ones are: `payerName` is optional on these dialects too, and an
            // unnamed bank still has to print as something a reader can act
            // on. Without this the interpolation could be erased and nothing
            // would notice.
            assertEq(result.line1[0]?.payer, 'payer 11-1111111')
        },
        // A transposition between two faces leaves every total untouched, so
        // the box paths are asserted directly. `k1_1041`'s interest box is
        // literally `box1InterestIncome`, the same field name the 1099-INT
        // uses — which is why the K-1 paths are dialect-qualified and the
        // 1099 paths are not.
        boxPathsAreDialectQualifiedForK1sAndBareForTheNineteenNinetyNines: () => {
            const result = scheduleB({
                interestForms: [interestForm('1.00')(undefined)('int-doc-1')],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box5InterestIncome: '2.00' })('k1-1065-d')],
                sCorporationK1Forms: [sCorporationK1({ box4InterestIncome: '3.00' })('k1-1120s-d')],
                estateTrustK1Forms: [estateTrustK1({ box1InterestIncome: '4.00' })('k1-1041-d')],
                profile: profileNoForeign,
            })
            assertEq(result.line1.length, 4)
            assertEq(result.line1[0]?.sources[0].boxPath, 'box1InterestIncome')
            assertEq(result.line1[1]?.sources[0].boxPath, 'k1_1065.box5InterestIncome')
            assertEq(result.line1[2]?.sources[0].boxPath, 'k1_1120s.box4InterestIncome')
            assertEq(result.line1[3]?.sources[0].boxPath, 'k1_1041.box1InterestIncome')
            // Each row cites its own document, by that document's own hash.
            assertEq(result.line1[3]?.sources[0].documentHash, 'k1-1041-d')
        },
        // DOC-11, at the row level: a K-1 whose only amount is a box this
        // schedule does not take produces NO row — the printed form has no
        // line for a payer who paid no interest.
        aDocumentWithNoInScopeBoxContributesNoRowAtAll: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box1OrdinaryBusinessIncome: '80000.00' })('k1-1065-e')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line1.length, 0)
            assertEq(result.line2.value, 0n)
            // …and the empty listing still yields a traceable line, citing
            // the profile rather than inventing a zero from nowhere.
            assertEq(result.line2.sources.length, 1)
            assertEq(result.line2.sources[0].boxPath, 'declaredKinds')
        },
    },
    partTwo: {
        k1DividendsAreOneRowPerDocumentNamedByTheIssuingEntity: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [
                    partnershipK1({ payerName: 'Northwind Ventures LP', box6aOrdinaryDividends: '900.00' })('k1-1065-f'),
                ],
                sCorporationK1Forms: [
                    sCorporationK1({ payerName: 'Northwind Software Inc.', box5aOrdinaryDividends: '800.00' })('k1-1120s-f'),
                ],
                estateTrustK1Forms: [
                    estateTrustK1({ payerName: 'The Harrow Family Trust', box2aOrdinaryDividends: '700.00' })('k1-1041-f'),
                ],
                profile: profileNoForeign,
            })
            assertEq(result.line5.length, 3)
            assertEq(result.line5[0]?.payer, 'Northwind Ventures LP')
            assertEq(result.line5[1]?.payer, 'Northwind Software Inc.')
            assertEq(result.line5[2]?.payer, 'The Harrow Family Trust')
            assertEq(result.line5[0]?.sources[0].boxPath, 'k1_1065.box6aOrdinaryDividends')
            assertEq(result.line5[1]?.sources[0].boxPath, 'k1_1120s.box5aOrdinaryDividends')
            assertEq(result.line5[2]?.sources[0].boxPath, 'k1_1041.box2aOrdinaryDividends')
            // $9.00 + $8.00 + $7.00 = $24.00, in hundreds of cents.
            assertEq(result.line6.value, 240000n)
        },
        rowsSumToLineSix: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [dividendForm('45.50')('div-doc-1')],
                partnershipK1Forms: [partnershipK1({ box6aOrdinaryDividends: '900.00' })('k1-1065-g')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line5.length, 2)
            // $45.50 + $900.00 = $945.50, hand-typed.
            assertEq(result.line6.value, 94550n)
            // The 1099-DIV fallback name — Part II's twin of the Part I
            // assertion above.
            assertEq(result.line5[0]?.payer, 'payer 11-1111111')
            assertEq(
                result.line5.reduce((total, row) => total + row.value, 0n),
                result.line6.value,
                'printed line 6 is "Add the amounts on line 5" — the listing must add up to it',
            )
        },
        // Box 6c is a SECOND partnership summand, not a slice of 6a. It sits
        // on the partnership face alone, and omitting it would make line 6
        // disagree with 1040 line 3b for any partner holding a §871(m)
        // dividend equivalent.
        thePartnerDividendEquivalentBoxIsASecondSummandOnTheSameRow: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [
                    partnershipK1({
                        box6aOrdinaryDividends: '900.00',
                        box6cDividendEquivalents: '150.00',
                    })('k1-1065-h'),
                ],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line5.length, 1, 'one document is one row, however many of its boxes are read')
            assertEq(result.line5[0]?.sources.length, 2)
            assertEq(result.line5[0]?.sources[1]?.boxPath, 'k1_1065.box6cDividendEquivalents')
            // $900.00 + $150.00 = $1,050.00.
            assertEq(result.line6.value, 105000n)
        },
        // The CONTROL for the summand above: a qualified box is a SUBSET of
        // its ordinary sibling and feeds 1040 line 3a only. Adding one here
        // would count the same dividend twice, so line 6 must not move.
        qualifiedDividendBoxesNeverEnterScheduleB: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [
                    partnershipK1({
                        box6aOrdinaryDividends: '900.00',
                        box6bQualifiedDividends: '900.00',
                    })('k1-1065-i'),
                ],
                sCorporationK1Forms: [
                    sCorporationK1({
                        box5aOrdinaryDividends: '800.00',
                        box5bQualifiedDividends: '800.00',
                    })('k1-1120s-i'),
                ],
                estateTrustK1Forms: [
                    estateTrustK1({
                        box2aOrdinaryDividends: '700.00',
                        box2bQualifiedDividends: '700.00',
                    })('k1-1041-i'),
                ],
                profile: profileNoForeign,
            })
            // $9.00 + $8.00 + $7.00 = $24.00 — the ORDINARY boxes alone. If a
            // qualified box had leaked in, this would read $48.00.
            assertEq(result.line6.value, 240000n)
            assertEq(result.line5.length, 3)
            for (const row of result.line5) {
                assertEq(row.sources.length, 1, 'exactly one box per row: the ordinary one')
            }
        },
    },
    // ── The gap `fjs/todo/schedule-b-omits-k1-interest-and-dividends.md`
    //    recorded, and its controls ─────────────────────────────────────────
    //
    // The note's own reachable state, quoted: "1040 line 2b is $4,000.00,
    // entirely from a partner's box 5. Schedule B line 4 is $0.00,
    // `interestOverThreshold` is false, and Part III is not required."
    scheduleK1CrossesTheThreshold: {
        fourThousandOfPartnerInterestAloneMakesPartThreeRequired: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box5InterestIncome: '4000.00' })('k1-1065-j')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line4.value, 400000n, 'line 4 must be the $4,000.00 that reaches 1040 line 2b')
            assertEq(result.interestOverThreshold, true)
            assertEq(result.partThreeRequired, true)
        },
        shareholderBoxFourAloneMakesPartThreeRequired: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [sCorporationK1({ box4InterestIncome: '4000.00' })('k1-1120s-j')],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line4.value, 400000n)
            assertEq(result.partThreeRequired, true)
        },
        beneficiaryBoxOneAloneMakesPartThreeRequired: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [estateTrustK1({ box1InterestIncome: '4000.00' })('k1-1041-j')],
                profile: profileNoForeign,
            })
            assertEq(result.line4.value, 400000n)
            assertEq(result.partThreeRequired, true)
        },
        partnerBoxSixAAloneMakesPartThreeRequired: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                partnershipK1Forms: [partnershipK1({ box6aOrdinaryDividends: '4000.00' })('k1-1065-k')],
                sCorporationK1Forms: [],
                estateTrustK1Forms: [],
                profile: profileNoForeign,
            })
            assertEq(result.line6.value, 400000n)
            assertEq(result.dividendsOverThreshold, true)
            assertEq(result.interestOverThreshold, false, 'a dividend must not trip the INTEREST test')
            assertEq(result.partThreeRequired, true)
        },
        // ── The controls the note asked for by name ──────────────────────
        //
        // "A control is needed either way: a filer whose K-1 interest is
        // *below* $1,500 must not acquire Part III." Without these, a
        // threshold that fired on any K-1 at all would pass everything above.
        controls: {
            k1InterestBelowTheThresholdDoesNotAcquirePartThree: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [],
                    partnershipK1Forms: [partnershipK1({ box5InterestIncome: '1499.99' })('k1-1065-m')],
                    sCorporationK1Forms: [],
                    estateTrustK1Forms: [],
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 149999n)
                assertEq(result.interestOverThreshold, false)
                assertEq(result.partThreeRequired, false)
            },
            k1InterestExactlyAtTheThresholdDoesNotAcquirePartThree: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [],
                    partnershipK1Forms: [],
                    sCorporationK1Forms: [],
                    estateTrustK1Forms: [estateTrustK1({ box1InterestIncome: '1500.00' })('k1-1041-m')],
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 150000n)
                assertEq(
                    result.interestOverThreshold,
                    false,
                    'the form says "over $1,500", and that is no less strict for a K-1',
                )
                assertEq(result.partThreeRequired, false)
            },
            k1DividendsBelowTheThresholdDoNotAcquirePartThree: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [],
                    partnershipK1Forms: [],
                    sCorporationK1Forms: [sCorporationK1({ box5aOrdinaryDividends: '1499.99' })('k1-1120s-m')],
                    estateTrustK1Forms: [],
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 149999n)
                assertEq(result.dividendsOverThreshold, false)
                assertEq(result.partThreeRequired, false)
            },
            // The two tests stay INDEPENDENT once K-1s can reach them: a
            // partner's $1,200 interest and $1,200 dividends is $2,400
            // combined and trips neither, exactly as the 1099-only leaf
            // below already proves for banks.
            k1InterestAndDividendsAreStillNeverCombinedIntoOneTest: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [],
                    partnershipK1Forms: [
                        partnershipK1({
                            box5InterestIncome: '1200.00',
                            box6aOrdinaryDividends: '1200.00',
                        })('k1-1065-n'),
                    ],
                    sCorporationK1Forms: [],
                    estateTrustK1Forms: [],
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 120000n)
                assertEq(result.line6.value, 120000n)
                assertEq(result.interestOverThreshold, false)
                assertEq(result.dividendsOverThreshold, false)
                assertEq(result.partThreeRequired, false)
            },
        },
    },
    thresholds: {
        // T-12-04's core behavior bullets: independent tests, never combined.
        twoThousandInterestOnlyTriggersInterestThresholdOnly: () => {
            const result = scheduleB({
                interestForms: [
                    interestForm('1000.00')(undefined)('int-doc-1'),
                    interestForm('1000.00')(undefined)('int-doc-2'),
                ],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.line4.value, 200000n, 'line 4 = $2,000.00')
            assertEq(result.interestOverThreshold, true)
            assertEq(result.dividendsOverThreshold, false)
        },
        twoThousandDividendsOnlyTriggersDividendThresholdOnly: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [dividendForm('2000.00')('div-doc-1')],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.line6.value, 200000n, 'line 6 = $2,000.00')
            assertEq(result.interestOverThreshold, false)
            assertEq(result.dividendsOverThreshold, true)
        },
        // The load-bearing negative case: combined $2,000 split evenly across
        // the two categories must trip NEITHER threshold — the exact "common
        // error" this module exists to avoid.
        combinedButIndividuallyUnderThresholdTriggersNeither: () => {
            const result = scheduleB({
                interestForms: [interestForm('1000.00')(undefined)('int-doc-1')],
                dividendForms: [dividendForm('1000.00')('div-doc-1')],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.line4.value, 100000n, 'line 4 = $1,000.00')
            assertEq(result.line6.value, 100000n, 'line 6 = $1,000.00')
            assertEq(
                result.interestOverThreshold,
                false,
                'combined $2,000 split across two categories must not trip the interest test',
            )
            assertEq(
                result.dividendsOverThreshold,
                false,
                'combined $2,000 split across two categories must not trip the dividend test',
            )
        },
        boundary: {
            interestOneCentBelowDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [interestForm('1499.99')(undefined)('int-boundary-below')],
                    dividendForms: [],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 149999n)
                assertEq(result.interestOverThreshold, false)
            },
            interestExactlyAtThresholdDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [interestForm('1500.00')(undefined)('int-boundary-at')],
                    dividendForms: [],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 150000n)
                assertEq(
                    result.interestOverThreshold,
                    false,
                    'the form says "over $1,500", not "at least $1,500"',
                )
            },
            interestOneCentAboveTriggers: () => {
                const result = scheduleB({
                    interestForms: [interestForm('1500.01')(undefined)('int-boundary-above')],
                    dividendForms: [],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 150001n)
                assertEq(result.interestOverThreshold, true)
            },
            dividendsOneCentBelowDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1499.99')('div-boundary-below')],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 149999n)
                assertEq(result.dividendsOverThreshold, false)
            },
            dividendsExactlyAtThresholdDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1500.00')('div-boundary-at')],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 150000n)
                assertEq(result.dividendsOverThreshold, false)
            },
            dividendsOneCentAboveTriggers: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1500.01')('div-boundary-above')],
                    ...noScheduleK1s,
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 150001n)
                assertEq(result.dividendsOverThreshold, true)
            },
        },
    },
    partThreeRequired: {
        falseWhenNoneOfTheFourHold: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, false)
        },
        trueWhenInterestOverThreshold: () => {
            const result = scheduleB({
                interestForms: [interestForm('1500.01')(undefined)('int-1')],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenDividendsOverThreshold: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [dividendForm('1500.01')('div-1')],
                ...noScheduleK1s,
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenForeignAccountDeclaredAloneWithNoOtherTrigger: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileWithForeignAccount,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenForeignTrustDeclaredAloneWithNoOtherTrigger: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileWithForeignTrust,
            })
            assertEq(result.partThreeRequired, true)
        },
    },
    // Part III's answers are read VERBATIM from the profile, never inferred
    // from document presence/absence — proven with ZERO stored documents.
    foreignAccountFields: {
        readVerbatimNeverInferredFromZeroStoredDocuments: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileWithForeignAccount,
            })
            assertEq(
                result.hadForeignFinancialAccount,
                true,
                'read verbatim from the profile, not inferred from zero stored 1099s',
            )
            assertEq(result.requiredToFileFinCen114, false)
            assertEq(result.foreignAccountCountries, undefined)
            assertEq(result.receivedForeignTrustDistributionOrWasGrantorOrTransferor, false)
        },
        allFourFieldsPassThroughVerbatim: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                ...noScheduleK1s,
                profile: profileFullyDeclared,
            })
            assertEq(result.hadForeignFinancialAccount, true)
            assertEq(result.requiredToFileFinCen114, true)
            assertEq(result.foreignAccountCountries?.length, 2)
            assertEq(result.foreignAccountCountries?.[0], 'France')
            assertEq(result.foreignAccountCountries?.[1], 'Germany')
            assertEq(result.receivedForeignTrustDistributionOrWasGrantorOrTransferor, true)
        },
    },
    // Zero stored interest AND zero stored dividend documents still produce
    // valid ReportLines, each citing the profile's declaredKinds box.
    zeroStoredDocumentsStillProduceValidReportLinesCitingProfile: () => {
        const result = scheduleB({
            interestForms: [],
            dividendForms: [],
            ...noScheduleK1s,
            profile: profileNoForeign,
        })
        assertEq(result.line2.value, 0n)
        assertEq(result.line4.value, 0n)
        assertEq(result.line6.value, 0n)
        assertEq(result.line2.sources.length, 1)
        assertEq(result.line2.sources[0].documentHash, profileNoForeign.documentHash)
        assertEq(result.line2.sources[0].boxPath, 'declaredKinds')
        assertEq(result.line4.sources[0].boxPath, 'declaredKinds')
        assertEq(result.line6.sources[0].boxPath, 'declaredKinds')
    },
    // This module computes a schedule, not a stored document: its output
    // never carries a `dialect`/`mediaType` tag the way every `fjs/document/*`
    // and `fjs/return/*` blob does. (This module also imports no `dialect`
    // constant of its own, and is not registered in `finance_schema`'s
    // `dialectSchemas` — both grep-checkable negatives, verified statically.)
    dialectIndependence: () => {
        const result = scheduleB({
            interestForms: [],
            dividendForms: [],
            ...noScheduleK1s,
            profile: profileNoForeign,
        })
        assert(
            !('dialect' in result),
            'scheduleB output must not carry a dialect tag — this is a computed schedule, not a stored document',
        )
        assert(
            !('mediaType' in result),
            'scheduleB output must not carry a mediaType — this is a computed schedule, not a stored document',
        )
    },
}
