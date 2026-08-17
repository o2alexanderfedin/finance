/**
 * `vnd.fjs.return_profile` — the taxpayer-DECLARED return profile
 * (10-CONTEXT.md Decision 4).
 *
 * ## Why this document exists at all
 *
 * TAX-16 asks for a loud refusal whenever an input the engine does not model
 * would change the return. The obvious implementation — refuse when the CAS
 * store holds a document whose dialect we cannot read — **cannot work**:
 *
 * > The engine never sees the documents it cannot read.
 *
 * A taxpayer with a 1099-DIV in a drawer and none in CAS produces an empty
 * dividend line. So does a taxpayer with no dividends at all. An absent
 * document is indistinguishable from an absent income kind, so a store-driven
 * guard stays silent in exactly the case TAX-16 exists for. The comparison has
 * to be against something the taxpayer *declares* — which is this document.
 *
 * The same artefact resolves a second, unrelated defect. `ReportLine.sources`
 * (`fjs/report/line`) is a NON-EMPTY tuple of `{documentHash, boxPath, value}`,
 * enforced at `tsc` level, and the standard deduction (line 12e) derives from
 * a filing status and a set of checked boxes rather than from any document —
 * so line 12e could not be expressed at all. A stored profile is a real CAS
 * document with a real hash, so line 12e cites it and Phase 9's `tsc`
 * guarantee is left untouched rather than widened.
 *
 * ## Shape follows `fjs/document/1099int`'s four-stage template
 *
 * `dialect` -> `mediaType` -> schema -> structural `validateShape` -> semantic
 * `checkReferences` -> composed `validate`. AGENTS.md: new file formats follow
 * the `fjs/media/revision` precedent, so the tag is `vnd.fjs.return_profile`
 * and its media type is DERIVED by `mediaTypeOf`, never hand-written.
 *
 * ## Three schema decisions worth stating
 *
 * - **Every checkbox is `option(true)`, never a two-valued primitive.** DOC-12's
 *   rule, exactly as `corrected: option(true)` on the 1099-INT and
 *   `archived: option(true)` on `vnd.fjs.revision`: an unchecked box is the
 *   key's ABSENCE. `spouseIsBlind: false` is rejected structurally rather than
 *   accepted as "not blind", so a serializer that helpfully materializes every
 *   key cannot smuggle a checkbox in as data.
 * - **Every money box is `option(string)`.** AGENTS.md: money in a stored JSON
 *   document is a decimal string, never a JSON number — a JSON number is an
 *   IEEE 754 double by the time `media/json`'s `Unknown` sees it. Exactness is
 *   enforced in {@link checkReferences} via the shared
 *   `fjs/document/money_field` check, mirroring how `vnd.fjs.revision` types
 *   `hash` as a string and defers to `isHash`.
 * - **There is deliberately no `formRevision` field.** DOC-10 exists because
 *   printed IRS forms change box semantics between revisions of the same form,
 *   so a stored instance must carry the revision it was read from. This is not
 *   a printed form — nobody OCRs a return profile — and its versioning is the
 *   dialect tag itself. Adding a revision here would be cargo-culting DOC-10
 *   onto a document whose failure mode it does not describe.
 * - **The four foreign-account fields are additive, taxpayer-DECLARED, and
 *   deliberately carry no cross-field validation.** Schedule B Part III (TAX-07)
 *   asks whether the taxpayer had a foreign financial account, whether FinCEN
 *   Form 114 is required, which countries, and whether there was a foreign
 *   trust distribution/grantor/transferor relationship — none of which any IRS
 *   information return reports, so 12-CONTEXT.md's "taxpayer-DECLARED, never
 *   inferred" decision makes this document, not a transcribed 1099, their only
 *   possible source. `requiredToFileFinCen114` may be declared without
 *   `hadForeignFinancialAccount`: the two printed sub-questions are independent
 *   facts, and it is Schedule B, not this dialect, that decides what to do with
 *   the combination.
 * - **`itemizeEvenThoughLessThanStandardDeduction` (Schedule A line 18,
 *   TAX-13, 13-CONTEXT.md Decision 2.5) is a taxpayer ELECTION no document
 *   reports** — exactly like `hadForeignFinancialAccount`: no 1099 or W-2
 *   states that a taxpayer wants to itemize when the standard deduction is
 *   larger, so this dialect is the only possible source. Read only by
 *   `fjs/tax/deduction`'s `deductionChoice` (13-06); without it, a
 *   legitimate itemize-anyway return could not be expressed at all.
 * - **`dependents` (TAX-12, 13-CONTEXT.md Decision 4.1) is ADDITIVE, and
 *   `dependentCount` is KEPT rather than replaced.** `dependentCount` stays
 *   the load-bearing declaration existing proofs and the scope guard read;
 *   `dependents` is a per-dependent array Schedule 8812 needs to tell a
 *   qualifying child from an other dependent, which a bare count cannot
 *   express. Check 8 below enforces `dependents.length === dependentCount`
 *   whenever the array is present, so the two can never silently diverge.
 *   **Citizenship/national/resident-alien status is deliberately NOT one of
 *   this array's fields.** Schedule 8812's own docstring (Wave 4's later
 *   plan, `fjs/schedule/8812`) documents that trust boundary — the
 *   taxpayer's act of declaring a dependent already asserts it, and the
 *   printed form keys the CTC-vs-ODC classification itself on only two
 *   facts (age, SSN validity), both of which this array carries
 *   (13-CONTEXT.md Decision 5.7). This mirrors how `fjs/schedule/b`
 *   documents its own Form 8815 boundary.
 *
 * @module
 */
import { array, number, option, string } from 'functionalscript/fjs/types/rtti/module.f.js'
import { validate as rttiValidate } from 'functionalscript/fjs/types/rtti/validate/module.f.js'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.js'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.js'
import { base, mediaTypeOf } from '../../document/base/module.f.js'
import { moneyFieldError } from '../../document/money_field/module.f.js'
import {
    dialect as oneZeroNineNineIntDialect,
    oneZeroNineNineIntSchema,
} from '../../document/1099int/module.f.js'
import { individualFilingStatuses, taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/module.f.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/types/rtti/ts/module.f.js' */
/** @import { ValidationError } from 'functionalscript/fjs/types/rtti/validate/module.f.js' */

/**
 * Format tag: names the dialect of this BLOB. The media type it is served
 * with is derived mechanically: `application/` + `dialect` + `+json`.
 */
export const dialect = 'vnd.fjs.return_profile'
/** The media type derived from {@link dialect}: `application/vnd.fjs.return_profile+json`. */
export const mediaType = mediaTypeOf(dialect)

/**
 * The FROZEN vocabulary of income, deduction, credit and payment kinds a
 * taxpayer may declare on a 2025 Form 1040, in FORM ORDER so a reviewer can
 * diff this list against the printed face rather than against their memory of
 * it. The trailing comment on each member is the 1040 line it feeds.
 *
 * Frozen in the same sense `fjs/guest`'s four commands are: Plan 10-07 adds a
 * `tsc`-level assertion that every {@link Kind} is either modeled or carries a
 * refusal entry, so adding a member here without classifying it there stops at
 * `tsc`, before a test runs. That is the mechanism `fjs/guest`'s
 * `_CasOpIsExactlyTheFourCommands` already establishes.
 */
export const kindVocabulary = /** @type {const} */ ([
    'wages',                                // 1a
    'householdEmployeeWages',               // 1b
    'unreportedTips',                       // 1c
    'medicaidWaiverPayments',               // 1d
    'dependentCareBenefits',                // 1e
    'adoptionBenefits',                     // 1f
    'form8919Wages',                        // 1g
    'otherEarnedIncome',                    // 1h
    'nontaxableCombatPayElection',          // 1i
    'taxExemptInterest',                    // 2a
    'taxableInterest',                      // 2b
    'qualifiedDividends',                   // 3a
    'ordinaryDividends',                    // 3b
    'iraDistributions',                     // 4a/4b
    'pensionsAndAnnuities',                 // 5a/5b
    'socialSecurityBenefits',               // 6a/6b
    'unemploymentCompensation',             // Schedule 1 line 7 -> 8
    'capitalGainDistributions',             // 7a
    'capitalGainsOrLosses',                 // 7a via Schedule D
    'unrecaptured1250Gain',                 // Schedule D line 19
    'collectibles28RateGain',               // Schedule D line 18
    'section1202Gain',                      // 1099-DIV box 2c
    'investmentInterestForm4952',           // Form 4952 line 4g
    // ── Schedule 1 Part I's own lines, one kind each (DOC-20/21/TAX-30, Phase 27) ─
    //
    // `scheduleOneAdditionalIncome` stood here as ONE coarse kind for the
    // whole of Part I -- taxable state and local refunds, alimony received,
    // business income on Schedule C, other gains on Form 4797, rental and
    // pass-through income on Schedule E, farm income on Schedule F, and the
    // twenty-six lettered sub-lines at 8a-8z. A single kind covering that
    // many distinct income items could only ever refuse them together, so
    // nothing on Part I was nameable and nothing on it could be reclassified
    // one line at a time. It is split here into one kind per printed line, in
    // SCHEDULE 1's own order -- which is 1040 form order for the block as a
    // whole, since every one of these feeds line 10 and thence 1040 line 8.
    //
    // **This was the LAST of the five coarse kinds.** `fjs/return/scope`'s
    // own Wave-5 note named all five (`scheduleOneAdditionalIncome`,
    // `scheduleOneAdjustments`, `scheduleTwoTaxes`,
    // `scheduleThreeNonrefundableCredits`, `scheduleThreeRefundableCredits`)
    // and recorded, phase by phase, which had been taken apart; Phase 23 took
    // Schedule 2, Phase 24 Schedule 1 Part II, Phase 25 both halves of
    // Schedule 3, and this one takes the schedule that entry was still
    // waiting on.
    //
    // **Printed line 7 deliberately gets no kind HERE.** Unemployment
    // compensation already has one -- `unemploymentCompensation`, far above,
    // beside the 1040 lines it sits among in this vocabulary since Phase 20 --
    // and a second kind for one printed line would let a taxpayer declare the
    // income twice. It is the one Part I line whose kind is out of Schedule 1
    // order in this list, and that is history rather than design.
    //
    // Lines 9 and 10 get no kind either: line 9 is the TOTAL of the 8a-8z
    // block `otherIncome` already covers, and line 10 is Part I's own total.
    // A kind for either would be a declaration a taxpayer could never
    // truthfully make -- the identical reasoning Schedule 3's lines 7/8/14/15
    // already carry.
    //
    // One of the seven is MODELED as of this phase -- `businessIncomeOrLoss`,
    // Schedule C. The other six refuse by name, which is the whole point of
    // splitting: what remains unmodeled on Part I is now something a taxpayer
    // can be told.
    'taxableStateLocalRefunds',             // Schedule 1 line 1   -> 8
    'alimonyReceived',                      // Schedule 1 line 2a  -> 8
    'businessIncomeOrLoss',                 // Schedule 1 line 3   -> 8
    'otherGainsOrLosses',                   // Schedule 1 line 4   -> 8
    'rentalRealEstateRoyaltiesPartnershipsSCorps', // Schedule 1 line 5 -> 8
    'farmIncomeOrLoss',                     // Schedule 1 line 6   -> 8
    'otherIncome',                          // Schedule 1 line 8a-8z -> 8
    // ── Schedule 1 Part II's own lines, one kind each (TAX-23/24, Phase 24) ─
    //
    // `scheduleOneAdjustments` stood here as ONE coarse kind for the whole of
    // Part II -- educator expenses, the HSA deduction, the deductible half of
    // self-employment tax, the IRA deduction, alimony paid, student loan
    // interest and ten more printed lines. A single kind covering that many
    // distinct adjustments could only ever refuse them together, so nothing
    // on Part II was nameable and nothing on it could be reclassified one
    // line at a time. It is split here into one kind per printed line, in
    // SCHEDULE 1's own order -- which is 1040 form order for the block as a
    // whole, since every one of these feeds line 26 and thence 1040 line 10.
    //
    // **Printed line 22 deliberately gets no kind.** The form itself reserves
    // that line number with no box to fill, so a kind for it would be a
    // declaration a taxpayer could never truthfully make.
    //
    // Three of the thirteen are MODELED as of this phase --
    // `educatorExpenses`, `healthSavingsAccountDeduction` and
    // `studentLoanInterestDeduction`. The other ten refuse by name, which is
    // the whole point of splitting: what remains unmodeled on Part II is now
    // something a taxpayer can be told.
    'educatorExpenses',                     // Schedule 1 line 11  -> 10
    'reservistPerformingArtistFeeBasisExpenses', // Schedule 1 line 12 -> 10
    'healthSavingsAccountDeduction',        // Schedule 1 line 13  -> 10
    'movingExpensesArmedForces',            // Schedule 1 line 14  -> 10
    'deductiblePartOfSelfEmploymentTax',    // Schedule 1 line 15  -> 10
    'selfEmployedRetirementPlans',          // Schedule 1 line 16  -> 10
    'selfEmployedHealthInsuranceDeduction', // Schedule 1 line 17  -> 10
    'penaltyOnEarlyWithdrawalOfSavings',    // Schedule 1 line 18  -> 10
    'alimonyPaid',                          // Schedule 1 line 19a -> 10
    'iraDeduction',                         // Schedule 1 line 20  -> 10
    'studentLoanInterestDeduction',         // Schedule 1 line 21  -> 10
    'archerMsaDeduction',                   // Schedule 1 line 23  -> 10
    'otherAdjustments',                     // Schedule 1 line 24a-24z -> 10
    'itemizedDeductions',                   // 12e
    'netQualifiedDisasterLoss',             // 12e exception 5
    'qualifiedBusinessIncomeDeduction',     // 13a
    // ── Phase 28 (TAX-32): the ONE §199A input this engine cannot reach ─────
    //
    // Form 8995 lines 6-9 are the REIT/PTP component, and they are a
    // SEPARATE fact from the deduction itself: a taxpayer can have qualified
    // REIT dividends with no trade or business at all. Form 1099-DIV box 5
    // carries §199A dividends and `vnd.fjs.1099div` stores them, but nothing
    // reads that box, and PTP income needs Schedule K-1 (DOC-24, Phase 30).
    'qualifiedReitDividendsAndPtpIncome',   // Form 8995 lines 6-9 -> 13a
    'seniorAndOtherScheduleOneADeductions', // 13b
    // ── Schedule 2's own lines, one kind each (TAX-22, Phase 23) ────────────
    //
    // `scheduleTwoTaxes` stood here as ONE coarse kind for the whole of
    // Schedule 2 -- Part I's alternative minimum tax and repayments, Part
    // II's self-employment tax, Additional Medicare Tax, net investment
    // income tax and eleven more printed lines. A single kind covering that
    // many distinct taxes could only ever refuse them together, so nothing
    // on Schedule 2 was nameable and nothing on it could be reclassified
    // one line at a time. It is split here into one kind per printed line
    // group, in SCHEDULE 2's own order -- which is 1040 form order for the
    // block as a whole, since every one of these feeds either line 17
    // (Part I) or line 23 (Part II).
    //
    // **Schedule 2 lines 5 and 6 deliberately get no kind of their own.**
    // Line 5 is the Social Security and Medicare tax on unreported tips,
    // computed on Form 4137 -- which is exactly the remedy `unreportedTips`
    // (1040 line 1c, above) already names, for the same taxpayer fact. Line
    // 6 is the uncollected tax on Form 8919 wages, which `form8919Wages`
    // (1040 line 1g) already names. Adding a second kind for either would
    // give one fact two declarations and let a taxpayer declare the income
    // half without the tax half.
    'advancePremiumTaxCreditAndOtherRepayments', // Schedule 2 line 1a-1z -> 17
    'alternativeMinimumTax',                // Schedule 2 line 2  -> 17
    // ── Phase 29 (TAX-33): Form 6251 Part I's own lines, one kind each ──────
    //
    // Not a coarse kind being split -- `alternativeMinimumTax` above stays,
    // and it is the kind for the TAX ITSELF, which Phase 29 computes. These
    // fifteen are the §56/§57 ADJUSTMENTS AND PREFERENCES that feed it and
    // which this engine cannot compute, one per printed line of Form 6251
    // Part I, in the form's own order.
    //
    // **The reason they exist as kinds at all is the direction the error
    // runs.** A zero on a Form 6251 Part I line does not merely omit
    // something: it UNDERSTATES alternative minimum taxable income, and
    // therefore the tax. Every other unmodeled item in this vocabulary has a
    // printed line a reader can see is blank; these are add-backs, and a
    // blank add-back looks exactly like no add-back. So each is nameable and
    // each refuses the whole return when declared.
    //
    // **Lines 2c and 2h deliberately get no kind here.** Line 2c is the
    // investment interest expense difference, which needs Form 4952 --
    // exactly what `investmentInterestForm4952` (above, at the Schedule D Tax
    // Worksheet) already names, for the same missing form. Line 2h is 7% of a
    // §1202 exclusion, which needs the exclusion percentage `section1202Gain`
    // already refuses. A second kind for either would give one taxpayer fact
    // two declarations.
    //
    // **Lines 2e and 2f share ONE kind**, against this vocabulary's usual
    // one-per-printed-line rule. They are two halves of a single fact: 2e adds
    // the regular net operating loss deduction back and 2f allows the
    // alternative-tax one in its place. A taxpayer has an NOL or does not, and
    // could never truthfully declare one half.
    //
    // Line 2b (a state or local tax refund) gets no kind either, and that is
    // the one case where a zero is COMPUTED rather than unmodeled:
    // `fjs/document/1099g` refuses a non-zero box 2 at validation, so
    // Schedule 1 line 1 cannot be non-zero here, and line 8z is `otherIncome`,
    // already above.
    'amtDepletion',                         // Form 6251 line 2d -> Sch 2 line 2
    'amtNetOperatingLossDeduction',         // Form 6251 lines 2e/2f -> Sch 2 line 2
    'amtPrivateActivityBondInterest',       // Form 6251 line 2g -> Sch 2 line 2
    'amtEstatesAndTrusts',                  // Form 6251 line 2j -> Sch 2 line 2
    'amtDispositionOfProperty',             // Form 6251 line 2k -> Sch 2 line 2
    'amtDepreciation',                      // Form 6251 line 2l -> Sch 2 line 2
    'amtPassiveActivities',                 // Form 6251 line 2m -> Sch 2 line 2
    'amtLossLimitations',                   // Form 6251 line 2n -> Sch 2 line 2
    'amtCirculationCosts',                  // Form 6251 line 2o -> Sch 2 line 2
    'amtLongTermContracts',                 // Form 6251 line 2p -> Sch 2 line 2
    'amtMiningCosts',                       // Form 6251 line 2q -> Sch 2 line 2
    'amtResearchAndExperimentalCosts',      // Form 6251 line 2r -> Sch 2 line 2
    'amtPre1987InstallmentSales',           // Form 6251 line 2s -> Sch 2 line 2
    'amtIntangibleDrillingCosts',           // Form 6251 line 2t -> Sch 2 line 2
    'amtOtherAdjustments',                  // Form 6251 line 3  -> Sch 2 line 2
    'selfEmploymentTax',                    // Schedule 2 line 4  -> 23
    // ── Phase 28 (TAX-31): the two Schedule SE facts nothing stored can
    // reveal, each its own kind because they are separate taxpayer facts
    // with separate remedies ─────────────────────────────────────────────
    //
    // Neither has a kind of its own before this phase because Schedule SE
    // did not exist; both are on the printed page this phase transcribes,
    // and both change the tax rather than merely the presentation.
    'churchEmployeeIncome',                 // Schedule SE line 5a -> Sch 2 line 4
    'selfEmploymentOptionalMethods',        // Schedule SE Part II -> Sch 2 line 4
    'additionalTaxOnTaxFavoredAccounts',    // Schedule 2 line 8  -> 23
    'householdEmploymentTaxes',             // Schedule 2 line 9  -> 23
    'additionalMedicareTax',                // Schedule 2 line 11 -> 23
    'netInvestmentIncomeTax',               // Schedule 2 line 12 -> 23
    'uncollectedTaxOnTipsOrGroupTermLife',  // Schedule 2 line 13 -> 23
    'interestOnResidentialLotAndTimeshareInstallments', // Schedule 2 line 14 -> 23
    'interestOnDeferredInstallmentSaleTax', // Schedule 2 line 15 -> 23
    'lowIncomeHousingCreditRecapture',      // Schedule 2 line 16 -> 23
    'otherAdditionalTaxes',                 // Schedule 2 line 17a-17z -> 23
    'premiumTaxCreditReconciliation',       // Schedule 2 line 19 -> 23
    'section965NetTaxLiabilityInstallment', // Schedule 2 line 20 (memo)
    'childTaxCreditOrOtherDependents',      // 19
    // ── Schedule 3 Part I's own lines, one kind each (TAX-25/26, Phase 25) ──
    //
    // `scheduleThreeNonrefundableCredits` stood here as ONE coarse kind for
    // the whole of Part I -- the foreign tax credit, the dependent care
    // credit, education credits, the saver's credit, two residential energy
    // credits and thirteen more sub-lines at 6a-6z alone. A single kind
    // covering that many distinct credits could only ever refuse them
    // together, so nothing on Part I was nameable and nothing on it could be
    // reclassified one line at a time. It is split here into one kind per
    // printed line, in SCHEDULE 3's own order -- which is 1040 form order for
    // the block as a whole, since every one of these feeds line 8 and thence
    // 1040 line 20.
    //
    // **6a-6z stays ONE collapsed kind**, exactly as Schedule 1's
    // `otherAdjustments` (24a-24z) and Schedule 2's `otherAdditionalTaxes`
    // (17a-17z) do: the printed line 6 is a header over lettered sub-lines
    // with no dollar box of its own, this engine models none of them, and
    // inventing a kind per sub-line would put names in this frozen vocabulary
    // that no work here read off the printed page.
    //
    // Line 7 deliberately gets no kind: it is the TOTAL of the 6a-6z block
    // `otherNonrefundableCredits` already covers, and line 8 is Part I's own
    // total. A kind for either would be a declaration a taxpayer could never
    // truthfully make.
    'foreignTaxCredit',                     // Schedule 3 line 1  -> 20
    'dependentCareCredit',                  // Schedule 3 line 2  -> 20
    'educationCredits',                     // Schedule 3 line 3  -> 20
    'retirementSavingsContributionsCredit', // Schedule 3 line 4  -> 20
    'residentialCleanEnergyCredit',         // Schedule 3 line 5a -> 20
    'energyEfficientHomeImprovementCredit', // Schedule 3 line 5b -> 20
    'otherNonrefundableCredits',            // Schedule 3 line 6a-6z -> 20
    'federalTaxWithheldOnW2',               // 25a
    'federalTaxWithheldOn1099Int',          // 25b
    'federalTaxWithheldOnOther1099',        // 25b
    'federalTaxWithheldOnOtherForms',       // 25c
    'estimatedTaxPayments',                 // 26
    'earnedIncomeCredit',                   // 27a
    'additionalChildTaxCredit',             // 28
    'americanOpportunityCredit',            // 29
    'refundableAdoptionCredit',             // 30
    // ── Schedule 3 Part II's own lines, one kind each (Phase 25) ────────────
    //
    // `scheduleThreeRefundableCredits` stood here as ONE coarse kind for the
    // whole of Part II, and is split for the identical reason as Part I's
    // above. Every one of these feeds Schedule 3 line 15 and thence 1040 line
    // 31; 13a-13z stays one collapsed kind, and lines 14 and 15 get none
    // because they are totals.
    //
    // **None of the five is MODELED after this phase.** TAX-25 and TAX-26
    // reach Part I's lines 3 and 4 only; Part II is untouched. `excessSocial\
    // SecurityWithheld` is nonetheless the most interesting entry in this
    // block, because it is the one line on this schedule whose amount is
    // already derivable from documents this engine holds -- see its own
    // remedy string in `fjs/return/scope` and `fjs/schedule/3`'s own
    // docstring.
    'netPremiumTaxCredit',                  // Schedule 3 line 9  -> 31
    'amountPaidWithExtensionRequest',       // Schedule 3 line 10 -> 31
    'excessSocialSecurityWithheld',         // Schedule 3 line 11 -> 31
    'federalFuelTaxCredit',                 // Schedule 3 line 12 -> 31
    'otherPaymentsAndRefundableCredits',    // Schedule 3 line 13a-13z -> 31
    'foreignEarnedIncomeForm2555',          // line 16 wrapper
    'childsUnearnedIncomeForm8615',         // line 16 wrapper
    'farmIncomeAveragingScheduleJ',         // line 16 wrapper
    'form8814ChildInterestAndDividends',    // line 16 add-on
    'form4972LumpSumDistribution',          // line 16 add-on
    'section962Election',                   // line 16 add-on
    'educationCreditRecapture',             // line 16 add-on
    'form8621',                             // line 16 add-on
    'form8978',                             // line 16 add-on
])

/** One member of {@link kindVocabulary}.
 * @typedef {typeof kindVocabulary[number]} Kind
 */

/**
 * One entry of {@link returnProfileSchema}'s `dependents` array — the exact
 * four facts Schedule 8812 itself keys its CTC/ODC classification on
 * (13-RESEARCH.md §4): `relationship` (free text, the dependency-test detail
 * this array does not otherwise model), `ssnValidForEmployment` (line4's
 * "required SSN" test), `ageAtYearEnd` (line4's "under 17" test), and
 * `livedWithTaxpayer` (a fact every dependency claim relies on, though no
 * single 8812 line names it directly). The three boolean-shaped facts are
 * `option(true)`, DOC-12's convention extended to a taxpayer-asserted fact
 * rather than a printed checkbox: ABSENT means "not asserted true", the
 * conservative default for a credit-eligibility fact — a serializer that
 * helpfully materializes every key as `false` cannot smuggle a false
 * assertion in as a true one.
 */
const dependentEntrySchema = /** @type {const} */ ({
    relationship: string,
    ssnValidForEmployment: option(true),
    ageAtYearEnd: number,
    livedWithTaxpayer: option(true),
})

/**
 * rtti schema for a `return_profile` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob — DOC-00's criterion-1 discriminant, proven by
 * `proof.crossDialect` below.
 */
export const returnProfileSchema = /** @type {const} */ ({
    ...base(dialect),
    taxYear: number,
    filingStatus: string,
    // Line 12a — someone can claim you (or your spouse) as a dependent.
    claimedAsDependent: option(true),
    // Line 12b — married filing separately and your spouse itemizes.
    spouseItemizes: option(true),
    // Line 12c — dual-status alien.
    dualStatusAlien: option(true),
    // Line 12d — the four age/blindness boxes.
    taxpayerBornBeforeJan2_1961: option(true),
    taxpayerIsBlind: option(true),
    spouseBornBeforeJan2_1961: option(true),
    spouseIsBlind: option(true),
    // The i1040gi p33 footnote condition that alone permits a married-filing-
    // separately filer to check the two SPOUSE boxes above. See check 5b.
    spouseHadNoIncomeIsNotFilingAndIsNotADependent: option(true),
    dependentCount: number,
    declaredKinds: array(string),
    // Decision 5 — the IRS whole-dollar election, all-or-nothing per return.
    wholeDollarElection: option(true),
    // Standard Deduction Worksheet for Dependents input.
    earnedIncome: option(string),
    line26EstimatedTaxPayments: option(string),
    line35aRefundRequested: option(string),
    line36AppliedToNextYear: option(string),
    // Schedule B Part III, line 7a (first sub-question) — TAX-07. Taxpayer-
    // declared; no IRS information return reports this fact.
    hadForeignFinancialAccount: option(true),
    // Schedule B Part III, line 7a (second sub-question) — independent of
    // hadForeignFinancialAccount, since the printed form asks it as a
    // separate "if 'Yes'" sub-question rather than a derived consequence.
    requiredToFileFinCen114: option(true),
    // Schedule B Part III, line 7b — free-text country names, plural.
    foreignAccountCountries: option(array(string)),
    // Schedule B Part III, line 8.
    receivedForeignTrustDistributionOrWasGrantorOrTransferor: option(true),
    // Phase 13 Slice 1 (TAX-10), 13-CONTEXT.md Decision 5.1: the IRA-
    // deduction circularity refusal fires on THIS FIELD, not on the coarse
    // `scheduleOneAdjustments` kind — that kind cannot distinguish an IRA
    // deduction (which creates the Pub. 590-A / taxable-Social-Security
    // cycle) from an HSA or educator-expense adjustment, which does not.
    // Read only by `fjs/form1040/core`; no cross-field check needed here.
    iraDeductionDeclared: option(true),
    // Phase 13 Slice 1 (TAX-10): the Social Security Benefits Worksheet's
    // line 8 branches on this fact for a married-filing-separately filer —
    // no other 1040 line already carries it. Additive, taxpayer-declared,
    // and read only by `fjs/form1040/core`, mirroring
    // `spouseHadNoIncomeIsNotFilingAndIsNotADependent`'s own precedent: no
    // cross-field check here, since `fjs/form1040/core` gates the value by
    // `filingStatus` itself before ever passing it to the worksheet.
    mfsLivedWithSpouseAtAnyTimeInYear: option(true),
    // Schedule A line 18 (TAX-13, 13-CONTEXT.md Decision 2.5) — "elect to
    // itemize deductions even though they are less than your standard
    // deduction". A taxpayer election no document reports, exactly like
    // hadForeignFinancialAccount. Read only by `fjs/tax/deduction`'s
    // `deductionChoice` (13-06); no cross-field check needed here.
    itemizeEvenThoughLessThanStandardDeduction: option(true),
    // TAX-12 (13-CONTEXT.md Decision 4.1) — per-dependent facts Schedule
    // 8812 needs to classify a qualifying child versus an other dependent.
    // Additive, ABSENT for a return declaring `dependentCount: 0` and
    // itemizing nothing about its dependents (check 8 below). See this
    // module's own docstring, "schema decisions worth stating", for why
    // citizenship is deliberately NOT a fifth field here.
    dependents: option(array(dependentEntrySchema)),
})

/** @typedef {Ts<typeof returnProfileSchema>} ReturnProfile */

/** Structural-only validator: checks the shape, not the semantic refinements below. */
const validateShape = rttiValidate(returnProfileSchema)

/**
 * The money-box field names this dialect carries, walked in a loop so the
 * exactness re-parse (DRY) is written once rather than four times. Typed via
 * `@type {const}` — not a wider `keyof ReturnProfile` annotation — so
 * `r[field]` resolves to exactly `string | undefined` rather than the union of
 * every field's type.
 */
const moneyBoxFields = /** @type {const} */ ([
    'earnedIncome',
    'line26EstimatedTaxPayments',
    'line35aRefundRequested',
    'line36AppliedToNextYear',
])

/**
 * {@link kindVocabulary} widened to a plain string list. This is an ordinary
 * widening ASSIGNMENT, not a cast: the tuple's literal member types are a
 * subtype of `string`, so nothing is silenced. It exists because the value
 * being tested arrives from an untrusted blob as a `string`, and
 * `readonly ['wages', ...]`'s own `.includes` would reject that argument at
 * compile time — which would be the compiler refusing to let us ask the
 * question the check exists to answer.
 * @type {readonly string[]}
 */
const kindNames = kindVocabulary

/**
 * The permitted `filingStatus` values, widened the same way and for the same
 * reason. Read from `fjs/tax/params` rather than restated here: a status this
 * dialect accepted but that module had no parameters for would be a profile
 * the engine cannot compute.
 * @type {readonly string[]}
 */
const filingStatusNames = individualFilingStatuses

/**
 * The filing statuses that may check NO spouse age/blindness box, because
 * there is no spouse for a box to describe.
 *
 * `[i1040gi p33, Lines 12a-12d]` — "**Don't check any boxes for your spouse if
 * your filing status is head of household.**" A `'single'` filer has no
 * spouse, and a `'qualifyingSurvivingSpouse'` filer's spouse is deceased.
 * These three statuses are exactly the ones the 1040-SR Standard Deduction
 * Chart caps at TWO boxes, while `'marriedFilingJointly'` and
 * `'marriedFilingSeparately'` reach FOUR — see 10-CONTEXT.md's chart, which
 * records the same maxima read from `f1040s.pdf` p4.
 * @type {readonly string[]}
 */
const statusesWithoutSpouseBoxes = ['single', 'headOfHousehold', 'qualifyingSurvivingSpouse']

/**
 * Either a structural validation error or a semantic (string) error message.
 * @typedef {ValidationError | string} ReturnProfileError
 */

/**
 * Checks the semantic refinements the structural schema cannot express, in a
 * fixed order so a blob failing several reports the most fundamental first:
 *
 * 1. `filingStatus` names a status `fjs/tax/params` actually stores.
 * 2. `taxYear` is an integer with a stored parameter set. An unsupported year
 *    refuses LOUDLY at ingest instead of failing deep inside a computation
 *    where the cause is no longer visible. The lookup is bound to a local and
 *    compared against `undefined` (`noUncheckedIndexedAccess` makes that
 *    `undefined` real) — no cast, no non-null assertion.
 * 3. `dependentCount` is a non-negative integer.
 * 4. Every declared kind is a member of {@link kindVocabulary} and appears
 *    once. The refusal names the offending kind AND the known vocabulary,
 *    mirroring `finance_schema`'s unknown-dialect refusal.
 * 5. Spouse boxes are absent for the three statuses that have no spouse.
 * 5b. Married filing separately's spouse boxes require the footnote condition.
 * 6. Every PRESENT money box is an exact decimal string at the cents scale.
 * 7. A present line-26 amount has `'estimatedTaxPayments'` declared.
 * 8. A present `dependents` array's length equals `dependentCount`.
 *
 * Nothing here throws: every refusal is an `error(...)` the caller unwraps, so
 * a hostile blob can never escape `validate` as an exception.
 * @type {(r: ReturnProfile) => Result<ReturnProfile, ReturnProfileError>}
 */
export const checkReferences = r => {
    // 1 — a status with no stored parameters is not computable.
    if (!filingStatusNames.includes(r.filingStatus)) {
        return error(
            `unknown filingStatus: ${r.filingStatus}; known: ${filingStatusNames.join(', ')}`,
        )
    }
    // 2 — an unsupported tax year, refused at the boundary.
    if (!Number.isInteger(r.taxYear)) {
        return error(`taxYear must be a whole year: ${r.taxYear}`)
    }
    const params = taxParamsByYear[r.taxYear]
    if (params === undefined) {
        return error(`no stored tax parameters for taxYear ${r.taxYear}`)
    }
    // 3
    if (!Number.isInteger(r.dependentCount) || r.dependentCount < 0) {
        return error(`dependentCount must be a non-negative whole count: ${r.dependentCount}`)
    }
    // 4 — the frozen vocabulary, and no repeats. A repeated kind would make
    // "declared once" and "declared twice" indistinguishable to any later
    // set comparison, so it is refused rather than silently deduplicated.
    for (const kind of r.declaredKinds) {
        if (!kindNames.includes(kind)) {
            return error(`unknown declared kind: ${kind}; known: ${kindNames.join(', ')}`)
        }
        if (r.declaredKinds.indexOf(kind) !== r.declaredKinds.lastIndexOf(kind)) {
            return error(`duplicate declared kind: ${kind}`)
        }
    }
    // 5 — see {@link statusesWithoutSpouseBoxes} for the primary source.
    if (
        statusesWithoutSpouseBoxes.includes(r.filingStatus)
        && (r.spouseBornBeforeJan2_1961 !== undefined || r.spouseIsBlind !== undefined)
    ) {
        return error(
            `filingStatus ${r.filingStatus} may not check a spouse age or blindness box`,
        )
    }
    // 5b — married filing separately's third and fourth boxes are CONDITIONAL,
    // and the condition is enforced here rather than assumed.
    //
    // `[i1040gi p33 / f1040s.pdf p4 footnote]` — a married-filing-separately
    // filer may check the spouse boxes only "if your spouse had no income,
    // isn't filing a return, and can't be claimed as a dependent on another
    // person's return." Quoting that and then accepting both boxes
    // unconditionally would hand an MFS return up to $3,200 (two boxes x
    // $1,600) of standard deduction it may not be entitled to, silently —
    // the same class of defect 10-CONTEXT.md Decision 6 exists to prevent for
    // a qualifying surviving spouse, one status over.
    //
    // The flag is a taxpayer ASSERTION, not a derivation: this engine cannot
    // observe the spouse's income or filing behaviour, so it records that the
    // taxpayer claimed the condition. That is what makes the resulting
    // deduction attributable to a declaration rather than to an assumption.
    if (
        r.filingStatus === 'marriedFilingSeparately'
        && (r.spouseBornBeforeJan2_1961 !== undefined || r.spouseIsBlind !== undefined)
        && r.spouseHadNoIncomeIsNotFilingAndIsNotADependent === undefined
    ) {
        return error(
            'marriedFilingSeparately may check a spouse age or blindness box only when '
            + 'spouseHadNoIncomeIsNotFilingAndIsNotADependent is declared',
        )
    }
    // 6 — DOC-11: an absent box is skipped, never defaulted to zero.
    for (const field of moneyBoxFields) {
        const printed = r[field]
        if (printed === undefined) {
            continue
        }
        const message = moneyFieldError(field)(printed)
        if (message !== undefined) {
            return error(message)
        }
    }
    // 7 — an amount with no declared kind is an input the scope guard never
    // sees: the silent omission this whole phase exists to prevent, appearing
    // inside the very document meant to prevent it.
    if (
        r.line26EstimatedTaxPayments !== undefined
        && !r.declaredKinds.includes('estimatedTaxPayments')
    ) {
        return error(
            'line26EstimatedTaxPayments is present but declaredKinds does not name '
            + "'estimatedTaxPayments'",
        )
    }
    // 8 — TAX-12/13-CONTEXT.md Decision 4.1: `dependentCount` stays the
    // load-bearing declaration; `dependents`, when present, must agree with
    // it exactly, or Schedule 8812's per-dependent classification and the
    // scope guard's coarse count would silently describe two different
    // returns.
    if (r.dependents !== undefined && r.dependents.length !== r.dependentCount) {
        return error(
            `dependents array length (${r.dependents.length}) does not match `
            + `dependentCount (${r.dependentCount})`,
        )
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `return_profile` BLOB:
 * structural (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 *
 * Dialect discrimination happens exclusively through `validateShape`'s
 * exact-literal match on `returnProfileSchema.dialect` — an already-parsed
 * value's `dialect` field compared as a schema constant, the same machinery
 * every other field goes through. Nothing in this file inspects serialized
 * JSON text to decide a dialect; `proof.crossDialect` is the runtime evidence.
 * @type {(value: Unknown) => Result<ReturnProfile, ReturnProfileError>}
 */
export const validate = value => {
    const [t, v] = validateShape(value)
    if (t === 'error') {
        return error(v)
    }
    return checkReferences(v)
}

// ── Tests ────────────────────────────────────────────────────────────────────

/**
 * The smallest profile that validates: a single filer with no dependents, no
 * declared kinds and no amounts. Every fixture below is this plus one
 * deliberate change, so a leaf's failure localizes to that change.
 * @type {ReturnProfile}
 */
const minimal = {
    dialect,
    taxYear: 2025,
    filingStatus: 'single',
    dependentCount: 0,
    declaredKinds: [],
}

/**
 * T-10-04-02, the shape T-09-08-02 already caught once on the 1099-INT: a
 * money box's name could be quietly dropped from {@link moneyBoxFields}
 * without anyone noticing — the field stays `option(string)` structurally, so
 * a comma-grouped amount in a dropped box would then validate as ok. One
 * generated leaf per NAMED box supplies a comma-grouped value to that box
 * alone, asserts `validate` refuses, AND asserts the refusal names that box,
 * so the leaf cannot pass because some unrelated check fired first.
 *
 * The fixture declares `'estimatedTaxPayments'` deliberately: without it, the
 * `line26EstimatedTaxPayments` leaf would be satisfied by cross-field check 7
 * rather than by the exactness loop it is meant to exercise.
 *
 * A box's own generated leaf disappears WITH it if the box is dropped, so this
 * alone cannot catch a removal — {@link expectedMoneyBoxFieldCount} pairs it
 * with an independently hand-typed count.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedMoneyBoxExactnessProof = Object.fromEntries(
    moneyBoxFields.map(field => [
        field,
        () => {
            const [t, v] = validate({
                ...minimal,
                declaredKinds: ['estimatedTaxPayments'],
                [field]: '1,234.56',
            })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
            assert(typeof v === 'string', ['expected a semantic string refusal', field, v])
            assert(v.includes(field), ['expected the refusal to name the offending box', field, v])
        },
    ]),
)

/**
 * Independently hand-typed: the number of money boxes
 * {@link moneyBoxFields} names today. Deliberately NOT
 * `moneyBoxFields.length` — if it were, dropping a box would shrink both
 * sides together and this check could never fail. The duplication is the
 * mechanism, not a smell (AGENTS.md).
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 4

/**
 * Independently hand-typed: the size of the frozen {@link kindVocabulary},
 * counted off the 1040 face rather than read from `kindVocabulary.length`,
 * for the same reason.
 *
 * `51 -> 64` is Phase 23's own Schedule 2 split (TAX-22): one coarse
 * `scheduleTwoTaxes` removed and fourteen per-printed-line kinds added in
 * its place. The arithmetic is `51 - 1 + 14`, and it is written out because
 * a count that moves by thirteen without a stated reason is indistinguishable
 * from a count somebody adjusted until the suite went green.
 *
 * `64 -> 76` is Phase 24's own Schedule 1 Part II split (TAX-23/TAX-24), the
 * same shape one schedule over: one coarse `scheduleOneAdjustments` removed
 * and thirteen per-printed-line kinds added in its place, `64 - 1 + 13`.
 * Thirteen rather than sixteen because the printed Part II's line 22 is
 * reserved with no box to fill, and lines 24/25 are one collapsed lettered
 * block plus its own total — see the vocabulary's own comment above.
 *
 * `76 -> 86` is Phase 25's own Schedule 3 split (TAX-25/TAX-26), the same
 * shape one schedule further on. TWO coarse kinds are removed here rather
 * than one — `scheduleThreeNonrefundableCredits` and
 * `scheduleThreeRefundableCredits` — and twelve per-printed-line kinds added,
 * `76 - 2 + 12`. Seven for Part I (lines 1, 2, 3, 4, 5a, 5b and the collapsed
 * 6a-6z) and five for Part II (lines 9, 10, 11, 12 and the collapsed
 * 13a-13z); lines 7, 8, 14 and 15 get none, because all four are totals.
 *
 * **This paragraph said "and the last of the five coarse kinds
 * `fjs/return/scope`'s Wave 5 note listed" until Phase 27, and that was
 * false when it was written.** `scheduleOneAdditionalIncome` was still
 * standing — that note's own text says so, in the same repository, in the
 * words *"`scheduleOneAdditionalIncome` is the ONLY one of the original five
 * left"*. The claim is corrected rather than deleted, because a count
 * docstring that overstates what a phase finished is exactly how the next
 * phase comes to believe there is nothing left to split.
 *
 * `86 -> 92` is Phase 27's own Schedule 1 PART I split (DOC-20/DOC-21/
 * TAX-30), which really is the last: one coarse `scheduleOneAdditionalIncome`
 * removed and seven per-printed-line kinds added, `86 - 1 + 7`. Seven rather
 * than nine because printed line 7 already has `unemploymentCompensation`
 * (Phase 20) and lines 9 and 10 are totals — see the vocabulary's own comment
 * above.
 *
 * `92 -> 95` is Phase 28's own (TAX-31/TAX-32), and it is NOT a split: no
 * coarse kind is removed, because none was left. Three kinds are ADDED for
 * three facts the two new forms print and nothing stored can reveal —
 * `churchEmployeeIncome` (Schedule SE line 5a and §1402(g)'s exemption
 * behind it), `selfEmploymentOptionalMethods` (Schedule SE Part II) and
 * `qualifiedReitDividendsAndPtpIncome` (Form 8995 lines 6-9). A vocabulary
 * grows when a form arrives that can name something it could not name
 * before, and this is the first phase since Phase 20 where it grew for that
 * reason rather than by taking a coarse kind apart.
 *
 * `95 -> 110` is Phase 29's own (TAX-33), and it grows for that same reason
 * a second time: Form 6251 arrives and can name fifteen §56/§57 adjustments
 * and preferences that had no printed line in this engine before. NOTHING was
 * split — `alternativeMinimumTax` stays exactly where it was and is the kind
 * for the tax itself, which that phase computes.
 * @type {number}
 */
const expectedKindCount = 110

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.return_profile')
        assertEq(mediaType, 'application/vnd.fjs.return_profile+json')
    },
    kindVocabularyIsExactlyOneHundredAndTen: () => {
        assertEq(kindVocabulary.length, expectedKindCount)
        assertEq(new Set(kindVocabulary).size, kindVocabulary.length)
    },
    validate: {
        minimalValidates: () => {
            const [t] = validate(minimal)
            assertEq(t, 'ok')
        },
        twoDeclaredKindsValidate: () => {
            const [t] = validate({ ...minimal, declaredKinds: ['wages', 'taxableInterest'] })
            assertEq(t, 'ok')
        },
        fullyPopulatedValidates: () => {
            const [t] = validate({
                ...minimal,
                filingStatus: 'marriedFilingJointly',
                taxpayerBornBeforeJan2_1961: true,
                taxpayerIsBlind: true,
                spouseBornBeforeJan2_1961: true,
                spouseIsBlind: true,
                dependentCount: 2,
                declaredKinds: ['wages', 'taxableInterest', 'estimatedTaxPayments'],
                wholeDollarElection: true,
                earnedIncome: '50000.00',
                line26EstimatedTaxPayments: '1234.56',
                line35aRefundRequested: '100.00',
                line36AppliedToNextYear: '0.00',
            })
            assertEq(t, 'ok')
        },
        // Sibling of fullyPopulatedValidates rather than an edit to it: proves
        // the four new foreign-account fields validate ALONGSIDE every
        // already-existing field, without touching that leaf's own assertions.
        fullyPopulatedWithForeignAccountFieldsValidates: () => {
            const [t] = validate({
                ...minimal,
                filingStatus: 'marriedFilingJointly',
                taxpayerBornBeforeJan2_1961: true,
                taxpayerIsBlind: true,
                spouseBornBeforeJan2_1961: true,
                spouseIsBlind: true,
                dependentCount: 2,
                declaredKinds: ['wages', 'taxableInterest', 'estimatedTaxPayments'],
                wholeDollarElection: true,
                earnedIncome: '50000.00',
                line26EstimatedTaxPayments: '1234.56',
                line35aRefundRequested: '100.00',
                line36AppliedToNextYear: '0.00',
                hadForeignFinancialAccount: true,
                requiredToFileFinCen114: true,
                foreignAccountCountries: ['France', 'Germany'],
                receivedForeignTrustDistributionOrWasGrantorOrTransferor: true,
            })
            assertEq(t, 'ok')
        },
        wrongDialectRejected: () => {
            const [t, v] = validate({ ...minimal, dialect: 'vnd.fjs.wrong' })
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path[0], 'dialect')
        },
    },
    checkReferences: {
        filingStatus: {
            unknownFilingStatusRefusedByName: () => {
                const [t] = validate({ ...minimal, filingStatus: 'marriedFilingSingly' })
                assertEq(t, 'error')
            },
            everyStoredFilingStatusAccepted: () => {
                for (const status of individualFilingStatuses) {
                    const [t] = validate({ ...minimal, filingStatus: status })
                    assertEq(t, 'ok', ['expected a stored filing status to validate', status])
                }
            },
        },
        taxYear: {
            unsupportedYearRefused: () => {
                const [t] = validate({ ...minimal, taxYear: 2024 })
                assertEq(t, 'error')
            },
        },
        dependentCount: {
            negativeRefused: () => {
                const [t] = validate({ ...minimal, dependentCount: -1 })
                assertEq(t, 'error')
            },
            fractionalRefused: () => {
                const [t] = validate({ ...minimal, dependentCount: 1.5 })
                assertEq(t, 'error')
            },
        },
        declaredKinds: {
            unknownKindRefusedNamingItAndTheVocabulary: () => {
                const [t, v] = validate({ ...minimal, declaredKinds: ['dogecoin'] })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(v.includes('dogecoin'), ['expected the offending kind named', v])
                assert(v.includes('taxableInterest'), ['expected the known vocabulary named', v])
            },
            duplicateKindRefused: () => {
                const [t] = validate({ ...minimal, declaredKinds: ['wages', 'wages'] })
                assertEq(t, 'error')
            },
        },
        spouseBoxes: {
            headOfHouseholdSpouseBlindRefused: () => {
                const [t] = validate({ ...minimal, filingStatus: 'headOfHousehold', spouseIsBlind: true })
                assertEq(t, 'error')
            },
            marriedFilingJointlySpouseBlindAccepted: () => {
                const [t] = validate({ ...minimal, filingStatus: 'marriedFilingJointly', spouseIsBlind: true })
                assertEq(t, 'ok')
            },
            singleSpouseBornBeforeRefused: () => {
                const [t] = validate({ ...minimal, spouseBornBeforeJan2_1961: true })
                assertEq(t, 'error')
            },
            qualifyingSurvivingSpouseSpouseBlindRefused: () => {
                const [t] = validate({
                    ...minimal,
                    filingStatus: 'qualifyingSurvivingSpouse',
                    spouseIsBlind: true,
                })
                assertEq(t, 'error')
            },
            marriedFilingSeparatelySpouseBoxWithoutConditionRefused: () => {
                const [t, v] = validate({
                    ...minimal,
                    filingStatus: 'marriedFilingSeparately',
                    spouseIsBlind: true,
                })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(
                    v.includes('spouseHadNoIncomeIsNotFilingAndIsNotADependent'),
                    ['expected the gating field named', v],
                )
            },
            marriedFilingSeparatelySpouseBoxWithConditionAccepted: () => {
                const [t] = validate({
                    ...minimal,
                    filingStatus: 'marriedFilingSeparately',
                    spouseIsBlind: true,
                    spouseHadNoIncomeIsNotFilingAndIsNotADependent: true,
                })
                assertEq(t, 'ok')
            },
            conditionFlagWithoutSpouseBoxesAccepted: () => {
                const [t] = validate({
                    ...minimal,
                    filingStatus: 'marriedFilingSeparately',
                    spouseHadNoIncomeIsNotFilingAndIsNotADependent: true,
                })
                assertEq(t, 'ok')
            },
        },
        moneyBoxExactness: {
            ...generatedMoneyBoxExactnessProof,
            everyMoneyBoxIsCovered: () => {
                assertEq(
                    moneyBoxFields.length,
                    expectedMoneyBoxFieldCount,
                    [
                        'expected exactly the independently-stated money box count',
                        moneyBoxFields.length,
                        expectedMoneyBoxFieldCount,
                    ],
                )
            },
        },
        crossField: {
            estimatedPaymentWithoutDeclaredKindRefused: () => {
                const [t] = validate({ ...minimal, line26EstimatedTaxPayments: '1234.56' })
                assertEq(t, 'error')
            },
            estimatedPaymentWithDeclaredKindAccepted: () => {
                const [t] = validate({
                    ...minimal,
                    declaredKinds: ['estimatedTaxPayments'],
                    line26EstimatedTaxPayments: '1234.56',
                })
                assertEq(t, 'ok')
            },
        },
    },
    // TAX-07: Schedule B Part III's four additive, taxpayer-declared fields.
    // Structurally independent from every existing check above — no leaf here
    // touches `checkReferences`'s seven-step order or `declaredKinds`.
    foreignAccountFields: {
        allFourPresentValidate: () => {
            const [t, v] = validate({
                ...minimal,
                hadForeignFinancialAccount: true,
                requiredToFileFinCen114: true,
                foreignAccountCountries: ['France', 'Germany'],
                receivedForeignTrustDistributionOrWasGrantorOrTransferor: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.foreignAccountCountries?.length, 2)
            assertEq(v.foreignAccountCountries?.[0], 'France')
            assertEq(v.foreignAccountCountries?.[1], 'Germany')
        },
        // Same DOC-12 discipline as every other checkbox on this dialect: a
        // structural `false` is rejected, not accepted as "not applicable".
        eachCheckboxRejectsFalse: () => {
            const [t1] = validate({ ...minimal, hadForeignFinancialAccount: false })
            assertEq(t1, 'error')
            const [t2] = validate({
                ...minimal,
                receivedForeignTrustDistributionOrWasGrantorOrTransferor: false,
            })
            assertEq(t2, 'error')
            // `requiredToFileFinCen114` was omitted here until the Phase 12
            // code review (12-REVIEW.md WR-01). The omission was not a live
            // defect — the shipped schema already rejected `false` — but it
            // was an unguarded one: widening this single field from
            // `option(true)` to `option(boolean)` passed `tsc --noEmit` AND
            // the entire suite with zero failures. A green suite over a
            // silently shrunk guarantee is exactly the failure this file's
            // sibling count-constants exist to prevent, so every checkbox on
            // this dialect is asserted individually rather than by sampling.
            const [t3] = validate({ ...minimal, requiredToFileFinCen114: false })
            assertEq(t3, 'error')
        },
        // Pins the "no forced ordering" behavior claim as a proof, not just a
        // docstring assertion: the two printed sub-questions are independent
        // facts, so declaring only the second validates on its own.
        requiredToFileWithoutHadAccountValidates: () => {
            const [t] = validate({ ...minimal, requiredToFileFinCen114: true })
            assertEq(t, 'ok')
        },
        multipleCountriesRoundTripInOrder: () => {
            const [t, v] = validate({
                ...minimal,
                foreignAccountCountries: ['Japan', 'Canada'],
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.foreignAccountCountries?.length, 2)
            assertEq(v.foreignAccountCountries?.[0], 'Japan')
            assertEq(v.foreignAccountCountries?.[1], 'Canada')
        },
    },
    // Phase 13 Slice 1 (TAX-10), Decision 5.1: two additive fields, both
    // read only by `fjs/form1040/core`, both structurally independent of
    // every check above — no leaf here touches `checkReferences`'s order or
    // `declaredKinds`.
    scheduleOneCircularityFields: {
        iraDeductionDeclaredValidates: () => {
            const [t, v] = validate({ ...minimal, iraDeductionDeclared: true })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.iraDeductionDeclared, true)
        },
        mfsLivedWithSpouseAtAnyTimeInYearValidates: () => {
            const [t, v] = validate({
                ...minimal,
                filingStatus: 'marriedFilingSeparately',
                mfsLivedWithSpouseAtAnyTimeInYear: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.mfsLivedWithSpouseAtAnyTimeInYear, true)
        },
        // DOC-12, same discipline as every other checkbox on this dialect: a
        // structural `false` is rejected, not accepted as "not applicable".
        eachCheckboxRejectsFalse: () => {
            const [t1] = validate({ ...minimal, iraDeductionDeclared: false })
            assertEq(t1, 'error')
            const [t2] = validate({ ...minimal, mfsLivedWithSpouseAtAnyTimeInYear: false })
            assertEq(t2, 'error')
        },
    },
    // TAX-13 (13-CONTEXT.md Decision 2.5): Schedule A line 18's
    // itemize-anyway election. Structurally independent of every check
    // above — no leaf here touches `checkReferences`'s order or
    // `declaredKinds`.
    scheduleALine18Election: {
        itemizeEvenThoughLessThanStandardDeductionValidates: () => {
            const [t, v] = validate({ ...minimal, itemizeEvenThoughLessThanStandardDeduction: true })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.itemizeEvenThoughLessThanStandardDeduction, true)
        },
        // DOC-12, same discipline as every other checkbox on this dialect: a
        // structural `false` is rejected, not accepted as "not applicable".
        falseRejected: () => {
            const [t] = validate({ ...minimal, itemizeEvenThoughLessThanStandardDeduction: false })
            assertEq(t, 'error')
        },
    },
    // TAX-12 (13-CONTEXT.md Decision 4.1): the `dependents` array and its
    // cross-field length check against `dependentCount` (checkReferences
    // step 8). Structurally independent of every check above.
    dependentsArray: {
        // Test 1 — a matching length validates.
        matchingLengthValidates: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCount: 1,
                dependents: [
                    { relationship: 'daughter', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
        },
        // Test 2 — a mismatched length is refused, naming both numbers.
        mismatchedLengthRefusedNamingBothNumbers: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCount: 2,
                dependents: [
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 15, livedWithTaxpayer: true },
                ],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('1'), ['expected the array length named', v])
            assert(v.includes('2'), ['expected dependentCount named', v])
        },
        // Test 3 — `dependents` omitted entirely, with `dependentCount: 0`,
        // is a real, valid state: the array is present only when there is
        // something to itemize.
        omittedWithZeroCountValidates: () => {
            const [t] = validate(minimal)
            assertEq(t, 'ok')
        },
        // Test 4 — a dependent entry round-trips all four fields.
        entryRoundTripsAllFourFields: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCount: 1,
                dependents: [
                    {
                        relationship: 'grandson',
                        ssnValidForEmployment: true,
                        ageAtYearEnd: 12,
                        livedWithTaxpayer: true,
                    },
                ],
            })
            assert(t === 'ok', ['expected ok', t, v])
            const entry = v.dependents?.[0]
            assert(entry !== undefined, ['expected a dependent entry', v])
            assertEq(entry.relationship, 'grandson')
            assertEq(entry.ssnValidForEmployment, true)
            assertEq(entry.ageAtYearEnd, 12)
            assertEq(entry.livedWithTaxpayer, true)
        },
        // DOC-12, same discipline as every other checkbox on this dialect: a
        // structural `false` on either boolean-shaped fact is rejected, not
        // accepted as "not applicable".
        eachCheckboxRejectsFalse: () => {
            const [t1] = validate({
                ...minimal,
                dependentCount: 1,
                dependents: [
                    { relationship: 'son', ssnValidForEmployment: false, ageAtYearEnd: 10, livedWithTaxpayer: true },
                ],
            })
            assertEq(t1, 'error')
            const [t2] = validate({
                ...minimal,
                dependentCount: 1,
                dependents: [
                    { relationship: 'son', ssnValidForEmployment: true, ageAtYearEnd: 10, livedWithTaxpayer: false },
                ],
            })
            assertEq(t2, 'error')
        },
    },
    crossDialect: {
        // DOC-00 criterion 1: a fully-valid `vnd.fjs.1099int` value —
        // constructed as a PARSED JS OBJECT, never a JSON string, so the
        // rejection is proven structural rather than a prefix probe on the
        // serialized text — fails this dialect's `validate`, and the failure's
        // path is exactly `['dialect']`: the discriminant catches it first,
        // not some unrelated missing field further down the schema.
        oneZeroNineNineIntShapeRejectedByReturnProfile: () => {
            /** @type {Ts<typeof oneZeroNineNineIntSchema>} */
            const oneZeroNineNineIntValue = {
                dialect: oneZeroNineNineIntDialect,
                payerTin: '11-1111111',
                recipientTin: '222-22-2222',
                accountNumber: 'ACC-0001',
                taxYear: 2025,
                formRevision: '2025',
                box1InterestIncome: '1234.56',
            }
            const [t, v] = validate(oneZeroNineNineIntValue)
            assertEq(t, 'error')
            if (t !== 'error') {
                throw ['expected error', t, v]
            }
            if (typeof v === 'string') {
                throw ['expected a structural ValidationError, got a checkReferences string', v]
            }
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
    },
}
