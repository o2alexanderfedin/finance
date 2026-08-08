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
 * `vnd.fjs.1099int`/`vnd.fjs.1099div` documents plus the declared return
 * profile — the same relationship `fjs/tax/line16/qdcgt` had to
 * `vnd.fjs.1099div` before this phase existed. It is NOT wired into
 * `fjs/form1040/core`'s `form1040IncomeLines`/`form1040TaxAndPaymentLines`,
 * and it does not consult `fjs/return/scope`'s `classifyScope`. It imports
 * NOTHING at runtime from `fjs/tax/`, `fjs/return/scope`, or
 * `fjs/form1040/`.
 *
 * ## Two documented, deliberate scope boundaries
 *
 * - **Line 3 (Form 8815 excludable EE/I savings bond interest) is NOT
 *   modeled this phase** — Form 8815 does not exist in this codebase — so
 *   line 4 equals line 2 exactly. Not a silent gap: line 4 is constructed
 *   explicitly equal to line 2, with this paragraph as the record of why.
 * - **Lines 1 and 5 (the per-payer name+amount listing) are not separately
 *   materialized as structured output.** Every contributing document is
 *   already cited via each `ReportLine`'s `sources` tuple
 *   (documentHash + boxPath + value per document) — a STRONGER provenance
 *   record than a bare payer-name list — and TAX-07's stated success
 *   criterion is the threshold and foreign-account questions, not a
 *   payer-grouped listing.
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
 * The four box-sum helpers below (`sumBoxOverDocuments`, `addBoxSums`,
 * `documentLine`, `profileDeclaredZeroLine`) are reimplemented locally,
 * private and NOT imported from `fjs/form1040/core` — that module does not
 * export them, and this is the same "reimplement an idiom you cannot
 * import" pattern `fjs/server/finance_documents_list` already uses
 * (11-PATTERNS.md).
 *
 * @module
 */
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { centsFromString } from '../../exact/module.f.js'

/** @import { OneZeroNineNineInt } from '../../document/1099int/module.f.js' */
/** @import { OneZeroNineNineDiv } from '../../document/1099div/module.f.js' */
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
 * Everything Schedule B reads: stored 1099-INT and 1099-DIV documents, and
 * the one return profile a return has exactly one of.
 * @typedef {{
 *   readonly interestForms: readonly Stored<OneZeroNineNineInt>[],
 *   readonly dividendForms: readonly Stored<OneZeroNineNineDiv>[],
 *   readonly profile: Stored<ReturnProfile>,
 * }} ScheduleBInputs
 */

/**
 * The exact cents sum of one box over a set of documents, with one
 * {@link Source} per PRESENT box. `sources` is a PLAIN, possibly-empty array
 * — deliberately not a `ReportLine`; {@link documentLine} is where an empty
 * sum becomes a profile-declared zero instead.
 * @typedef {{ readonly value: bigint, readonly sources: readonly Source[] }} BoxSum
 */

/**
 * The exact cents sum of ONE box across a set of documents. DOC-11: an
 * absent box is ABSENT, never zero — a form that left a box blank
 * contributes nothing and cites nothing.
 * @type {<T>(documents: readonly Stored<T>[]) => (boxPath: string) => (read: (document: T) => string | undefined) => BoxSum}
 */
const sumBoxOverDocuments = documents => boxPath => read => {
    const sources = documents.flatMap(document => {
        const printed = read(document.value)
        return printed === undefined
            ? []
            : [{ documentHash: document.documentHash, boxPath, value: printed }]
    })
    return {
        value: sources.reduce((total, source) => total + centsFromString(source.value), 0n),
        sources,
    }
}

/**
 * Adds two {@link BoxSum}s.
 * @type {(a: BoxSum) => (b: BoxSum) => BoxSum}
 */
const addBoxSums = a => b => ({
    value: a.value + b.value,
    sources: [...a.sources, ...b.sources],
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
 * Everything Schedule B produces: Part I/II totals as `ReportLine`s, the two
 * independent threshold booleans, the Part III foreign-account echo, and the
 * combined "must complete Part III" flag.
 * @typedef {{
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
    const { interestForms, dividendForms, profile } = inputs
    const fromDocuments = documentLine(profile)

    const line2 = fromDocuments('Schedule B line 2')(addBoxSums(
        sumBoxOverDocuments(interestForms)('box1InterestIncome')(
            form => form.box1InterestIncome))(
        sumBoxOverDocuments(interestForms)('box3UsSavingsBondsAndTreasuryInterest')(
            form => form.box3UsSavingsBondsAndTreasuryInterest)))

    // Line 3 (Form 8815) is not modeled this phase — see module docstring —
    // so line 4 equals line 2 exactly.
    const line4 = { ...line2, rule: 'Schedule B line 4' }

    const line6 = fromDocuments('Schedule B line 6')(
        sumBoxOverDocuments(dividendForms)('box1aTotalOrdinaryDividends')(
            form => form.box1aTotalOrdinaryDividends))

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

export const proof = {
    thresholds: {
        // T-12-04's core behavior bullets: independent tests, never combined.
        twoThousandInterestOnlyTriggersInterestThresholdOnly: () => {
            const result = scheduleB({
                interestForms: [
                    interestForm('1000.00')(undefined)('int-doc-1'),
                    interestForm('1000.00')(undefined)('int-doc-2'),
                ],
                dividendForms: [],
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
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 149999n)
                assertEq(result.interestOverThreshold, false)
            },
            interestExactlyAtThresholdDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [interestForm('1500.00')(undefined)('int-boundary-at')],
                    dividendForms: [],
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
                    profile: profileNoForeign,
                })
                assertEq(result.line4.value, 150001n)
                assertEq(result.interestOverThreshold, true)
            },
            dividendsOneCentBelowDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1499.99')('div-boundary-below')],
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 149999n)
                assertEq(result.dividendsOverThreshold, false)
            },
            dividendsExactlyAtThresholdDoesNotTrigger: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1500.00')('div-boundary-at')],
                    profile: profileNoForeign,
                })
                assertEq(result.line6.value, 150000n)
                assertEq(result.dividendsOverThreshold, false)
            },
            dividendsOneCentAboveTriggers: () => {
                const result = scheduleB({
                    interestForms: [],
                    dividendForms: [dividendForm('1500.01')('div-boundary-above')],
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
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, false)
        },
        trueWhenInterestOverThreshold: () => {
            const result = scheduleB({
                interestForms: [interestForm('1500.01')(undefined)('int-1')],
                dividendForms: [],
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenDividendsOverThreshold: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [dividendForm('1500.01')('div-1')],
                profile: profileNoForeign,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenForeignAccountDeclaredAloneWithNoOtherTrigger: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
                profile: profileWithForeignAccount,
            })
            assertEq(result.partThreeRequired, true)
        },
        trueWhenForeignTrustDeclaredAloneWithNoOtherTrigger: () => {
            const result = scheduleB({
                interestForms: [],
                dividendForms: [],
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
