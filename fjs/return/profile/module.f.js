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
 * - **Every checkbox is `or(option, true)`, never a two-valued primitive.** DOC-12's
 *   rule, exactly as `corrected: or(option, true)` on the 1099-INT and
 *   `archived: or(option, true)` on `vnd.fjs.revision`: an unchecked box is the
 *   key's ABSENCE. `spouseIsBlind: false` is rejected structurally rather than
 *   accepted as "not blind", so a serializer that helpfully materializes every
 *   key cannot smuggle a checkbox in as data.
 * - **Every money box is `or(option, string)`.** AGENTS.md: money in a stored JSON
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
 * - **`movingExpensesArmedForcesPermanentChangeOfStation` (Form 3903's own
 *   pre-line checkbox) is a taxpayer CERTIFICATION no document reports.**
 *   §217 was suspended by TCJA §11049 for everybody except the case §217(g)
 *   leaves standing, and the 2025 Form 3903 asks the filer to certify it in
 *   so many words: *"You can deduct moving expenses only if you are a Member
 *   of the Armed Forces on active duty and, due to a military order, you,
 *   your spouse, or your dependents move because of a permanent change of
 *   station. Check here to certify that you meet these requirements."* No
 *   dialect in this engine carries "active duty" or "permanent change of
 *   station" — a Form W-2 box 12 code P proves a moving reimbursement was
 *   paid to a service member, and says nothing about a military order — so
 *   this dialect is the only possible source, exactly as it is for
 *   `itemizeEvenThoughLessThanStandardDeduction`. Read only by
 *   `fjs/schedule/1`, which REFUSES rather than computes when a moving
 *   expense reaches Schedule 1 line 14 without it: absence is *not asserted*,
 *   never *asserted false*, and the difference decides a deduction the law
 *   allows nobody else.
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
import { array, number, open, option, or, string } from 'functionalscript/fjs/rtti/module.f.mjs'
import { validate as rttiValidate } from 'functionalscript/fjs/rtti/validate/module.f.mjs'
import { error, ok } from 'functionalscript/fjs/types/result/module.f.mjs'
import { assert, assertEq } from 'functionalscript/fjs/asserts/module.f.mjs'
import { base, mediaTypeOf } from '../../document/base/module.f.js'
import { moneyFieldError } from '../../document/money_field/module.f.js'
import { daysInTheLongestYear } from '../../document/rental_property/module.f.js'
import {
    dialect as oneZeroNineNineIntDialect,
    oneZeroNineNineIntSchema,
} from '../../document/1099int/module.f.js'
import { individualFilingStatuses, taxParamsByYear } from '../../tax/params/module.f.js'

/** @import { Result } from 'functionalscript/fjs/types/result/types.js' */
/** @import { Ts, Unknown } from 'functionalscript/fjs/rtti/ts/types.js' */
/** @import { ValidationError } from 'functionalscript/fjs/rtti/common/types.js' */

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
    // TAX-38. Form 6781 Part I -- section 1256 contracts marked to market --
    // IS modeled (`fjs/form6781`, over Form 1099-B box 11), and it computes
    // for a filer who declares `capitalGainsOrLosses` and nothing more. These
    // two name the parts of that form which are NOT modeled, so a filer who
    // has one can be told which printed line stops rather than being handed a
    // Part I computed as though the thing did not exist.
    'straddleGainsAndLosses',               // Form 6781 Parts II/III -> Schedule D 4/11
    'netSectionTwelveFiftySixContractsLossCarryback', // Form 6781 box D/line 6 -> Form 1045
    // ── Schedule 1 Part I's own lines, one kind each (DOC-20/21/TAX-30, Phase 27) ─
    //
    // `scheduleOneAdditionalIncome` stood here as ONE coarse kind for the
    // whole of Part I -- taxable state and local refunds, alimony received,
    // business income on Schedule C, other gains on Form 4797, rental and
    // pass-through income on Schedule E, farm income on Schedule F, and the
    // twenty-three lettered sub-lines at 8a-8z (8a through 8v and 8z; the
    // remedy that said twenty-six was counting letters the form does not
    // print). A single kind covering that
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
    // block, which is now twenty-eight kinds of its own below, and line 10
    // is Part I's own total.
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
    // ── Schedule 1 line 5's own five kinds, one per Schedule E PART ────────
    //
    // `rentalRealEstateRoyaltiesPartnershipsSCorps` stood here as ONE kind
    // for the whole of Schedule E, and it is the coarse kind Phase 27's own
    // split created rather than removed — its printed caption really does
    // name five different things, because printed Schedule 1 line 5 is the
    // total of a schedule with five parts. So this is the one place in this
    // vocabulary where a per-printed-LINE kind was still too coarse: line 5
    // has one line number and five sources, each with its own form, its own
    // documents and its own limitation rules.
    //
    // Split here by PART, in Schedule E's own order, which is also Schedule
    // 1 order for the block as a whole since all five feed line 5.
    //
    // **Printed Schedule E line 41 gets no kind, and neither do lines 42 or
    // 43.** Line 41 is Part V's TOTAL of the five parts above it — a kind for
    // it would let a taxpayer declare a sum without declaring anything it is a
    // sum of, the identical reasoning Schedule 1's lines 9/10 and Schedule 3's
    // lines 7/8/14/15 already carry. Lines 42 and 43 are reconciliations that
    // change no figure: line 42 restates farming and fishing income already on
    // line 41 for the §6654(i) estimated-tax exception, and line 43 restates a
    // real estate professional's participation. Neither adds to any total.
    //
    // One of the five is MODELED as of Phase 30 —
    // `partnershipAndSCorporationIncome`, Schedule E Part II, which
    // `fjs/schedule/e` computes from the two Schedule K-1 dialects. The other
    // four refuse by name, which is the whole point of splitting: a filer with
    // rental property is now told that Part I is what is missing, rather than
    // being refused for "Schedule E" as a whole or, worse, receiving a return
    // silently missing it.
    'rentalRealEstateAndRoyalties',         // Schedule E Part I (3-26)   -> Schedule 1 line 5 -> 8
    'partnershipAndSCorporationIncome',     // Schedule E Part II (27-32) -> Schedule 1 line 5 -> 8
    'estateAndTrustIncome',                 // Schedule E Part III (33-37) -> Schedule 1 line 5 -> 8
    'remicResidualInterest',                // Schedule E Part IV (38-39) -> Schedule 1 line 5 -> 8
    'netFarmRentalIncomeForm4835',          // Schedule E Part V line 40  -> Schedule 1 line 5 -> 8
    'farmIncomeOrLoss',                     // Schedule 1 line 6   -> 8
    // ── Schedule 1 line 8's own twenty-eight kinds (2026-08-18) ────────────
    //
    // `otherIncome` stood here as ONE kind for the whole of printed line 8 --
    // twenty-three lettered sub-lines, from a net operating loss carried in
    // from a year this engine does not hold, through gambling winnings,
    // Alaska Permanent Fund dividends, jury duty pay, prizes, hobby income
    // and stock options, to a write-in line the instructions leave open. A
    // single kind covering that many unrelated facts could only refuse them
    // together: a taxpayer with a Form 1099-C and a taxpayer with an
    // Alaska dividend read the SAME sentence, naming neither document.
    //
    // Split off `f1040s1.pdf` (2025) and `i1040gi.pdf` (2025) pp. 90-93, one
    // kind per printed sub-line, in the form's own order. The old remedy
    // said "twenty-six lettered sub-lines"; the printed form has
    // twenty-three -- 8a through 8v and 8z, with no 8w, 8x or 8y.
    //
    // **Two sub-lines get no kind here, because a kind for each already
    // exists.** Line 8d is the Form 2555 foreign earned income exclusion,
    // which `foreignEarnedIncomeForm2555` names; line 8s is the nontaxable
    // Medicaid waiver payment, which `medicaidWaiverPayments` names at 1040
    // line 1d. Both rows in `fjs/return/scope` are extended to name their
    // Schedule 1 line as well, the way `section1202Gain` names both a
    // 1099-DIV box and a Form 6251 line -- rather than a second declaration
    // being invented for one taxpayer fact. Since TAX-42 the line 8d kind is
    // `foreignEarnedIncomeExclusion`, and it is MODELED.
    //
    // **Line 8z is a WRITE-IN and is EIGHT kinds, not one.** Its
    // instructions name seven examples and then leave the line open ("any
    // taxable income not reported elsewhere"), so the seven are kinds and an
    // eighth, `otherIncomeNotListed`, is the residual. Seven alone would
    // assert a closed list the form refuses to close; the residual alone
    // would be the coarse kind under a new name.
    'netOperatingLossDeduction',                       // Schedule 1 line 8a  -> 8
    'gamblingWinnings',                                // Schedule 1 line 8b  -> 8
    'cancellationOfDebt',                              // Schedule 1 line 8c  -> 8
    'form8853MsaAndLongTermCareIncome',                // Schedule 1 line 8e  -> 8
    'healthSavingsAccountIncome',                      // Schedule 1 line 8f  -> 8
    'alaskaPermanentFundDividends',                    // Schedule 1 line 8g  -> 8
    'juryDutyPay',                                     // Schedule 1 line 8h  -> 8
    'prizesAndAwards',                                 // Schedule 1 line 8i  -> 8
    'notForProfitActivityIncome',                      // Schedule 1 line 8j  -> 8
    'stockOptionIncome',                               // Schedule 1 line 8k  -> 8
    'personalPropertyRentalIncome',                    // Schedule 1 line 8l  -> 8
    'olympicAndParalympicMedals',                      // Schedule 1 line 8m  -> 8
    'section951Inclusion',                             // Schedule 1 line 8n  -> 8
    'section951AInclusion',                            // Schedule 1 line 8o  -> 8
    'excessBusinessLossAdjustment',                    // Schedule 1 line 8p  -> 8
    'ableAccountDistributions',                        // Schedule 1 line 8q  -> 8
    'scholarshipAndFellowshipGrants',                  // Schedule 1 line 8r  -> 8
    'nonqualifiedDeferredCompensationPension',         // Schedule 1 line 8t  -> 8
    'wagesEarnedWhileIncarcerated',                    // Schedule 1 line 8u  -> 8
    'digitalAssetOrdinaryIncome',                      // Schedule 1 line 8v  -> 8
    'recoveriesOfAmountsDeductedInAnEarlierYear',      // Schedule 1 line 8z  -> 8
    'reemploymentTradeAdjustmentAssistance',           // Schedule 1 line 8z  -> 8
    'lossOnCorrectiveDistributionsOfExcessDeferrals',  // Schedule 1 line 8z  -> 8
    'insurancePolicyDividendsExceedingPremiums',       // Schedule 1 line 8z  -> 8
    'charitableContributionDeductionRecapture',        // Schedule 1 line 8z  -> 8
    'disasterReliefPayments',                          // Schedule 1 line 8z  -> 8
    'educationSavingsAccountDistributions',            // Schedule 1 line 8z  -> 8
    'otherIncomeNotListed',                            // Schedule 1 line 8z  -> 8
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
    // Three of the thirteen were MODELED as of the phase that split them --
    // `educatorExpenses`, `healthSavingsAccountDeduction` and
    // `studentLoanInterestDeduction`. SEVEN are today: `iraDeduction` and
    // `penaltyOnEarlyWithdrawalOfSavings` followed, then
    // `deductiblePartOfSelfEmploymentTax` beside the Schedule SE wiring and
    // `movingExpensesArmedForces` beside the Form 3903 wiring. The other six
    // refuse by name, which is the whole point of splitting: what remains
    // unmodeled on Part II is now something a taxpayer can be told. The
    // running count in a comment is what rots -- `fjs/return/scope`'s own
    // hand-typed `expectedModeledKindCount` is what is actually asserted.
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
    // ── Schedule 1 line 24's own ten kinds (2026-08-18) ────────────────────
    //
    // `otherAdjustments` stood here as ONE kind for the whole of printed line
    // 24, and the same argument applies as at line 8 above. Split off
    // `f1040s1.pdf` (2025) page 2 and `i1040gi.pdf` (2025) pp. 99-100, one
    // kind per printed sub-line. The old remedy said "eleven lettered
    // sub-lines"; the printed form has twelve, 24a through 24k and 24z.
    //
    // **Line 24j gets no kind here**: the Form 2555 housing deduction is
    // named by `foreignHousingExclusionOrDeduction`, one of Form 2555's four
    // kinds above. It was `foreignEarnedIncomeForm2555` until TAX-42 split
    // that row, and the split is exactly why line 24j and line 8d no longer
    // share one refusal: the deduction is blocked by Notice 2025-16's
    // underivable table and a prior-year carryover, and the exclusion is not
    // blocked at all.
    //
    // **Line 24z gets no kind at all**, and this is the one place in this
    // vocabulary where a write-in line does not. Its whole 2025 instruction
    // reads "Leave line 24z blank" (i1040gi p100), so there is nothing a
    // taxpayer could truthfully declare -- the same reasoning that gives a
    // reserved line and a total line no kind.
    'juryDutyPayGivenToEmployer',                 // Schedule 1 line 24a -> 10
    'personalPropertyRentalExpenses',             // Schedule 1 line 24b -> 10
    'olympicAndParalympicMedalsExclusion',        // Schedule 1 line 24c -> 10
    'reforestationAmortizationAndExpenses',       // Schedule 1 line 24d -> 10
    'tradeActSupplementalUnemploymentRepayment',  // Schedule 1 line 24e -> 10
    'section501c18DPensionContributions',         // Schedule 1 line 24f -> 10
    'chaplainSection403bContributions',           // Schedule 1 line 24g -> 10
    'unlawfulDiscriminationClaimAttorneyFees',    // Schedule 1 line 24h -> 10
    'irsWhistleblowerAwardAttorneyFees',          // Schedule 1 line 24i -> 10
    'excessDeductionsOfSection67eExpenses',       // Schedule 1 line 24k -> 10
    'itemizedDeductions',                   // 12e
    'netQualifiedDisasterLoss',             // 12e exception 5
    'qualifiedBusinessIncomeDeduction',     // 13a
    // ── Phase 28 (TAX-32): the ONE §199A input this engine cannot reach ─────
    //
    // Form 8995 lines 6-9 are the REIT/PTP component, and they are a
    // SEPARATE fact from the deduction itself: a taxpayer can have qualified
    // REIT dividends with no trade or business at all.
    //
    // **One coarse kind stood here until box 5 was wired, and it had to be
    // SPLIT rather than reclassified.** The two halves are not equally
    // reachable: a Form 1099-DIV box 5 is a number this engine now reads and
    // deducts, while publicly traded partnership income is refused TWICE
    // OVER -- `fjs/schedule/e`'s `section199AInformationRefusal` stops the
    // whole return for any K-1 carrying box 20 code Z or box 17 code V, and
    // that is a document-data refusal, so it fires whatever the profile
    // declares. Reclassifying the pair whole would have told a pipeline-K-1
    // holder that this engine computes their §199A deduction when it in fact
    // refuses to produce a return at all -- the overstatement TAX-16 exists
    // to prevent, and worse than the gap it replaced, which at least refused
    // loudly.
    'qualifiedReitDividends',               // 1099-DIV box 5 -> Form 8995 line 6 -> 13a
    'qualifiedPubliclyTradedPartnershipIncome', // K-1 box 20 code Z -> Form 8995 line 6 -> 13a
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
    // ── TAX-37: the coarse `advancePremiumTaxCreditAndOtherRepayments`
    // stood here and is SPLIT into the three sub-lines Schedule 2 line 1
    // actually prints, the way `scheduleTwoTaxes` was split one block up.
    //
    // The split is what makes reclassification honest. Form 8962 computes
    // line 1a and nothing computes 1b through 1f, and NOTHING STORED
    // DISTINGUISHES THEM: a taxpayer who transferred a clean vehicle credit
    // to a dealer would, under the coarse kind, have declared the very kind
    // the engine had just started computing, and received a silent zero for
    // the repayment they owe. Three kinds, one per printed sub-line, and each
    // says on its own face whether this engine can compute it.
    'excessAdvancePremiumTaxCreditRepayment', // Schedule 2 line 1a -> 17
    'cleanVehicleCreditRepayment',          // Schedule 2 lines 1b/1c -> 17
    'electivePaymentElectionRecapture',      // Schedule 2 lines 1d/1e/1f and 19 -> 17/23
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
    // Schedule 1 line 1 cannot be non-zero here, and line 8z's recovery is
    // `recoveriesOfAmountsDeductedInAnEarlierYear`, already above.
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
    // ── Form 6251 line 3's own seven kinds (2026-08-18) ────────────────────
    //
    // `amtOtherAdjustments` stood here as ONE kind for printed line 3. Split
    // off `i6251.pdf` (2025) pp. 8-9, which gives line 3 seven named
    // headings plus a "Related Adjustments" group.
    //
    // Six headings become kinds. The SEVENTH, "Net Qualified Disaster Loss",
    // gets none: it is the same increased standard deduction
    // `netQualifiedDisasterLoss` already names at 1040 line 12e, added back
    // for the AMT, and that row is extended to name this line too.
    //
    // **"Related Adjustments" is ONE kind, `amtRelatedAdjustments`, and that
    // is the one deliberate departure from one-kind-per-printed-fact in this
    // whole split.** Its seven affected items share a single blocker exactly
    // -- each is a limit recomputed on an AMT income base this engine does
    // not compute -- the printed form takes them COMBINED into one line 3
    // entry, and the instructions say "include the following", so the list is
    // not closed. Seven kinds would be seven copies of one remedy asserting a
    // closed set.
    'amtPre1987Depreciation',                       // Form 6251 line 3   -> 17
    'amtPollutionControlFacilities',                // Form 6251 line 3   -> 17
    'amtTaxShelterFarmActivities',                  // Form 6251 line 3   -> 17
    'amtCharitableContributionsOfCertainProperty',  // Form 6251 line 3   -> 17
    'amtBusinessInterestLimitation',                // Form 6251 line 3   -> 17
    'amtNonPrincipalResidenceMortgageInterest',     // Form 6251 line 3   -> 17
    'amtRelatedAdjustments',                        // Form 6251 line 3   -> 17
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
    // ── Schedule 2 line 17's own twenty kinds (2026-08-18) ─────────────────
    //
    // `otherAdditionalTaxes` stood here as ONE kind for the whole of printed
    // line 17. Split off `f1040s2.pdf` (2025) page 2 and `i1040gi.pdf` (2025)
    // pp. 113-114. The old remedy said "more than twenty lettered sub-lines";
    // the printed form has eighteen, 17a through 17q and 17z.
    //
    // **Line 17a is FOUR kinds, not one.** Its instruction lists five
    // numbered recaptures reaching four different forms, and the first two
    // are both the Form 3468 investment credit recaptured through Form 4255,
    // so they share one kind.
    //
    // **Lines 17p and 17q get no kind here**: both are interest from Form
    // 8621, the same PFIC holding `form8621` already names at 1040 line 16.
    //
    // **Line 17z is a WRITE-IN and is TWO kinds plus an extension.** Its
    // instructions name the prevailing wage and apprenticeship penalties
    // (its own kind) and a negative Form 8978 adjustment (`form8978`, whose
    // row is extended), and leave the line open -- so
    // `otherAdditionalTaxesNotListed` is the residual.
    'investmentCreditRecapture',                                // Schedule 2 line 17a -> 23
    'newMarketsCreditRecapture',                                // Schedule 2 line 17a -> 23
    'employerProvidedChildcareCreditRecapture',                 // Schedule 2 line 17a -> 23
    'section6418TransferRecapture',                             // Schedule 2 line 17a -> 23
    'federalMortgageSubsidyRecapture',                          // Schedule 2 line 17b -> 23
    'hsaDistributionAdditionalTax',                             // Schedule 2 line 17c -> 23
    'hsaIneligibleIndividualAdditionalTax',                     // Schedule 2 line 17d -> 23
    'archerMsaDistributionAdditionalTax',                       // Schedule 2 line 17e -> 23
    'medicareAdvantageMsaDistributionAdditionalTax',            // Schedule 2 line 17f -> 23
    'charitableFractionalInterestRecaptureTax',                 // Schedule 2 line 17g -> 23
    'section409ANonqualifiedPlanTax',                           // Schedule 2 line 17h -> 23
    'section457ANonqualifiedPlanTax',                           // Schedule 2 line 17i -> 23
    'section72m5ExcessBenefitsTax',                             // Schedule 2 line 17j -> 23
    'goldenParachutePaymentsTax',                               // Schedule 2 line 17k -> 23
    'accumulationDistributionOfTrustsTax',                      // Schedule 2 line 17l -> 23
    'expatriatedCorporationInsiderStockCompensationExciseTax',  // Schedule 2 line 17m -> 23
    'lookBackInterest',                                         // Schedule 2 line 17n -> 23
    'nonresidentAlienNonEffectivelyConnectedIncomeTax',         // Schedule 2 line 17o -> 23
    'prevailingWageAndApprenticeshipPenalties',                 // Schedule 2 line 17z -> 23
    'otherAdditionalTaxesNotListed',                            // Schedule 2 line 17z -> 23
    // MISNAMED, and knowingly so. Printed Schedule 2 (Form 1040) 2025 line 19
    // is "Recapture of net EPE from Form 4255, line 1d, column (l)" -- an
    // elective payment election recapture with no connection to Form 8962.
    // TAX-37 corrected this kind's refusal row in `fjs/return/scope` rather
    // than renaming it here, because renaming a member of this FROZEN
    // vocabulary invalidates every stored profile that declares it, and that
    // is a decision to take on purpose rather than as a side effect of wiring
    // a form. `electivePaymentElectionRecapture` above is the correctly named
    // kind for the same printed line.
    'premiumTaxCreditReconciliation',       // Schedule 2 line 19 -> 23 (see above: MISNAMED)
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
    // **6a-6z stayed ONE collapsed kind until 2026-08-18**, on the argument
    // that "inventing a kind per sub-line would put names in this frozen
    // vocabulary that no work here read off the printed page". That was a
    // statement about the work, not about the form, and it is answered by
    // doing the work: the eleven kinds in the block below are read off
    // `f1040s3.pdf` (2025) and `i1040gi.pdf` (2025) p116.
    //
    // Line 7 deliberately gets no kind: it is the TOTAL of the 6a-6z block,
    // and line 8 is Part I's own total. A kind for either would be a
    // declaration a taxpayer could never truthfully make.
    'foreignTaxCredit',                     // Schedule 3 line 1  -> 20
    'dependentCareCredit',                  // Schedule 3 line 2  -> 20
    'educationCredits',                     // Schedule 3 line 3  -> 20
    'retirementSavingsContributionsCredit', // Schedule 3 line 4  -> 20
    'residentialCleanEnergyCredit',         // Schedule 3 line 5a -> 20
    'energyEfficientHomeImprovementCredit', // Schedule 3 line 5b -> 20
    // ── Schedule 3 line 6's own eleven kinds (2026-08-18) ──────────────────
    //
    // `otherNonrefundableCredits` stood here as ONE kind for the whole of
    // printed line 6, and the comment above -- written when this block was
    // split and arguing that "inventing a kind per sub-line would put names
    // in this frozen vocabulary that no work here read off the printed page"
    // -- is what this split answers: the names below ARE read off the printed
    // page, `f1040s3.pdf` (2025), and off `i1040gi.pdf` (2025) p116.
    //
    // **Line 6e gets no kind**: the printed form reserves it for future use.
    // **Line 6l gets none either**: it is Form 8978's negative adjustment
    // arriving as a credit, the same audit `form8978` already names.
    // **Line 6z gets none at all**: its whole instruction reads "Leave
    // line 6z blank" (i1040gi p116).
    'generalBusinessCredit',                          // Schedule 3 line 6a  -> 20
    'priorYearMinimumTaxCredit',                      // Schedule 3 line 6b  -> 20
    'adoptionCredit',                                 // Schedule 3 line 6c  -> 20
    'creditForTheElderlyOrDisabled',                  // Schedule 3 line 6d  -> 20
    'newCleanVehicleCredit',                          // Schedule 3 line 6f  -> 20
    'mortgageInterestCredit',                         // Schedule 3 line 6g  -> 20
    'districtOfColumbiaFirstTimeHomebuyerCredit',     // Schedule 3 line 6h  -> 20
    'qualifiedElectricVehicleCredit',                 // Schedule 3 line 6i  -> 20
    'alternativeFuelVehicleRefuelingPropertyCredit',  // Schedule 3 line 6j  -> 20
    'creditToHoldersOfTaxCreditBonds',                // Schedule 3 line 6k  -> 20
    'previouslyOwnedCleanVehicleCredit',              // Schedule 3 line 6m  -> 20
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
    // 31; 13a-13z is its own eight kinds as of 2026-08-18, and lines 14 and
    // 15 get none because they are totals.
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
    // ── Schedule 3 line 13's own eight kinds (2026-08-18) ──────────────────
    //
    // `otherPaymentsAndRefundableCredits` stood here as ONE kind for the
    // whole of printed line 13. Split off `f1040s3.pdf` (2025) and
    // `i1040gi.pdf` (2025) p117. The old remedy's "five lettered sub-lines"
    // was right -- 13a, 13b, 13c, 13d and 13z.
    //
    // **Line 13z is a WRITE-IN and is FOUR kinds**: its instructions name
    // three credits outright -- §960(c)'s excess limitation account, Form
    // 8689's Virgin Islands allocation and Form 1062's farmland deferral --
    // and leave the line open, so a residual stands beside them.
    'form2439UndistributedCapitalGains',  // Schedule 3 line 13a -> 31
    'section1341CreditForRepayment',      // Schedule 3 line 13b -> 31
    'netElectivePaymentElectionAmount',   // Schedule 3 line 13c -> 31
    'deferredNet965TaxLiability',         // Schedule 3 line 13d -> 31
    'section960cExcessLimitationCredit',  // Schedule 3 line 13z -> 31
    'usVirginIslandsTaxAllocation',       // Schedule 3 line 13z -> 31
    'qualifiedFarmlandGainDeferral',      // Schedule 3 line 13z -> 31
    'otherRefundableCreditsNotListed',    // Schedule 3 line 13z -> 31
    // ── Form 2555's four kinds (TAX-42) ───────────────────────────────────
    //
    // `foreignEarnedIncomeForm2555` stood here as ONE kind naming three
    // printed destinations -- 1040 line 16, Schedule 1 line 8d and Schedule 1
    // line 24j -- on the stated ground that "one form produces them". That
    // was right while nothing was modelled and wrong the moment something
    // was: the three have three unrelated blockers, so a filer with no
    // housing claim was refused by a sentence about Notice 2025-16's table,
    // and nothing could be reclassified without reclassifying all of it.
    //
    // Split under this vocabulary's own rule -- one kind per fact a taxpayer
    // can truthfully declare having. See
    // `fjs/form2555/todo/foreign-earned-income.md` §6.
    'foreignEarnedIncomeExclusion',         // Schedule 1 line 8d -> 8; line 16 wrapper
    'foreignEarnedIncomeBonaFideResidenceTest',   // Form 2555 Part II
    'foreignHousingExclusionOrDeduction',   // Schedule 1 line 24j -> 10
    'foreignEarnedIncomeReceivedInAnotherTaxYear', // Form 2555 line 45 write-in
    'foreignEarnedIncomeCapitalGainExcess', // line 16 worksheet footnote
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
 * `or(option, true)`, DOC-12's convention extended to a taxpayer-asserted fact
 * rather than a printed checkbox: ABSENT means "not asserted true", the
 * conservative default for a credit-eligibility fact — a serializer that
 * helpfully materializes every key as `false` cannot smuggle a false
 * assertion in as a true one.
 */
const dependentEntrySchema = open({
    relationship: string,
    ssnValidForEmployment: or(option, true),
    ageAtYearEnd: number,
    livedWithTaxpayer: or(option, true),
    // ── TAX-27 (Phase 32): the five §32(c)(3) facts Schedule 8812's four
    // above cannot express. See {@link earnedIncomeCreditVocabularies} for
    // why every one of them is TWO OR MORE EXACT STRINGS rather than
    // `or(option, true)`, and `fjs/todo/tax-27-earned-income-credit.md` for the
    // fact-by-fact analysis that asked for them.
    //
    // `relationship` above is UNTOUCHED. It is Schedule 8812's, it is free
    // text by design, and narrowing it would change a document already
    // stored under a dialect whose readers depend on it. The §32 question is
    // a DIFFERENT question with a different answer set -- §32(c)(3)(A) reaches
    // §152(c)(2), which admits five relationships and no more -- so it gets
    // its own field, exactly as `fjs/todo/tax-27-earned-income-credit.md`
    // argues §32(c)(2) earned income must not share Schedule 8812's
    // `earnedIncome`. Two questions with the same name and different
    // definitions is the error, not the duplication.
    earnedIncomeCreditRelationship: or(option, string),
    earnedIncomeCreditFullTimeStudent: or(option, string),
    earnedIncomeCreditPermanentAndTotalDisability: or(option, string),
    earnedIncomeCreditUnitedStatesResidency: or(option, string),
    earnedIncomeCreditJointReturn: or(option, string),
})

/**
 * The largest `ageAtYearEnd` a {@link dependentEntrySchema} entry may carry,
 * enforced by check 11 in {@link checkReferences}.
 *
 * A named constant rather than a literal in the comparison, for the reason
 * `fjs/document/rental_property`'s `daysInTheLongestYear` gives: the
 * refusal quotes the bound, so the bound must be written once.
 *
 * ## Why 150, and why a bound at all
 *
 * The FLOOR is the interesting half and it is not arguable: a child born on
 * 31 December is `0` at year end, and no dependent is `-1`. Both consumers
 * compare against a threshold with `<` (`fjs/form8812`'s "under 17",
 * `fjs/schedule/eic`'s §152(c)(3) 19 and 24), so a negative age is *counted
 * as a child* — the expensive direction — and a fraction decides those
 * comparisons on a number that is not an age. Measured on this tree before
 * this check existed: a single dependent stored at `ageAtYearEnd: 16.999999`
 * takes Schedule 8812 line 14 to $2,200.00, and `17` takes it to $500.00.
 * $1,700 turned on a fourth decimal place of a whole-number field.
 *
 * The CEILING is the one that could do harm if chosen badly, because a
 * dependent is not necessarily a child: §152(d)'s qualifying relative has no
 * age test at all, so a filer supporting a parent or a grandparent stores a
 * real age in the nineties here. AGENTS.md — **"a check that fails when
 * everything is well is worse than no check"** — and the same trade the
 * rental-property author made picking 366 in EVERY year rather than 365 in
 * most: admitting an impossible value in the far tail costs nothing, and
 * refusing a legitimate one costs a return.
 *
 * So the ceiling is set far past any human lifetime rather than at one. 150
 * clears the oldest verified human on record (Jeanne Calment, 122) by 28
 * years, and it is above the largest age this dialect could ever be asked to
 * carry for any other reason. Nothing in the engine reads the region above
 * 24 differently from the region below 150 — every consumer branch is at 17,
 * 19 or 24 — so the ceiling decides no money at any input. Its whole job is
 * to catch a transcription that is not an age: a tax year typed into the age
 * box (`2025`), an age in months (`204`), or an overflowed double (`1e308`).
 * @type {number}
 */
export const oldestPlausibleDependentAge = 150

/**
 * The FROZEN vocabularies for §32's ten asserted facts — five per dependent
 * on {@link dependentEntrySchema} and five about the filer on
 * {@link returnProfileSchema}.
 *
 * ## Why these are exact strings and NOT `or(option, true)`
 *
 * This dialect's own rule, stated in its header, is that a boolean-shaped
 * fact is `or(option, true)` and ABSENCE means "not asserted true". That rule is
 * right wherever absence is the SAFE reading, and it is wrong here, for
 * exactly the reason `fjs/document/business_expenses` gives for its
 * `specifiedServiceTradeOrBusiness` flag — the precedent this group follows
 * rather than re-argues:
 *
 * - Under `or(option, true)`, absence and a denial are the same stored state. For
 *   `earnedIncomeCreditPermanentAndTotalDisability` the two are opposite
 *   answers to a question worth thousands of dollars: a disabled dependent has
 *   NO age limit at all (§152(c)(3)(B)), so reading an absent field as "not
 *   disabled" silently drops a 30-year-old qualifying child, and reading it as
 *   "disabled" silently keeps one who is not.
 * - **Here the wrong default GRANTS a credit.** That is the direction that
 *   decides the shape. `earnedIncomeCreditJointReturn` is the sharpest case:
 *   under `or(option, true)` the ABSENT state would have to mean "did not file a
 *   joint return", which is the state that qualifies the child — so a
 *   serializer that dropped the key, or a preparer who never asked, produces
 *   a credit rather than a refusal. As one of two exact strings, absence is
 *   *unstated* and `fjs/schedule/eic` refuses by name.
 * - `or(option, boolean)` would express three states while making the dangerous
 *   one cheap, as that same docstring records: *"a serializer that helpfully
 *   materializes every key"* would write `false`, indistinguishable from a
 *   taxpayer who answered no. A materialized `false` or `''` fails the
 *   vocabulary check below and is refused, quoted.
 *
 * The names are the statute's own words rather than `yes`/`no`, following
 * `fjs/document/k1_common`'s `materialParticipationValues`: a call site that
 * forgot to check cannot mistake `'didNotShareTheTaxpayersUnitedStatesAbode\
 * ForMoreThanHalfTheYear'` for a positive answer, and a bare `false` reads
 * like one at a glance.
 *
 * ## The relationship vocabulary has a NEGATIVE member, and it is load-bearing
 *
 * `'notAnEarnedIncomeCreditRelationship'` is the fifth relationship's
 * counterpart, and without it this array could not describe a real return.
 * The `dependents` array serves Schedule 8812 too, and a dependent PARENT is
 * a perfectly ordinary credit for other dependents (§24(h)(4)) while being no
 * §32(c)(3) qualifying child at all — §152(c)(2) reaches a child, a
 * descendant of a child, a sibling and a descendant of a sibling, and stops.
 * Without an explicit denial, that parent's absent field would be *unstated*,
 * `fjs/schedule/eic` would refuse, and a filer entitled to the CHILDLESS
 * credit could not obtain it. So the denial is expressible and the absence
 * still refuses.
 *
 * The five positive members are §152(c)(2) read through §152(f):
 * `'child'` covers son, daughter and a legally adopted or lawfully placed
 * child (§152(f)(1)(A)(i) and (B)); `'stepchild'` is that clause's stepson
 * and stepdaughter; `'eligibleFosterChild'` is §152(f)(1)(C)'s;
 * `'siblingOrStepOrHalfSibling'` is §152(c)(2)(B)'s brother, sister,
 * stepbrother and stepsister, widened by §152(f)(4) to the half blood; and
 * `'descendantOfAChildOrSibling'` is the *"or a descendant of"* in both
 * subparagraphs, which is what makes a grandchild, a niece and a nephew
 * qualify — the exact question the old free-text `relationship` field could
 * not answer, as this repo's own TAX-27 note records with `'niece'` as its
 * example.
 *
 * ## What is deliberately NOT here
 *
 * **§152(c)(4)'s tie-breaker**, where a child is the qualifying child of more
 * than one person. Expressing it needs another person's return, which this
 * engine has no way to hold, so it is an accepted TRUST BOUNDARY on the
 * taxpayer's own declaration — mirroring exactly how this dialect's header
 * records the citizenship boundary Schedule 8812 relies on, and how
 * `fjs/schedule/b` records its own Form 8815 boundary. It is written down
 * here rather than left silent, because a boundary nobody stated is a
 * boundary nobody can review.
 *
 * **§152(c)(1)(D)'s support test** is absent for a stronger reason: it does
 * not apply. §32(c)(3)(A) defines a qualifying child as §152(c)'s
 * *"determined without regard to paragraph (1)(D) thereof"*, so a field for
 * it would be a fact §32 does not ask for.
 */
export const earnedIncomeCreditVocabularies = /** @type {const} */ ({
    // §32(c)(3)(A) -> §152(c)(2), read through §152(f)(1) and (f)(4).
    earnedIncomeCreditRelationship: [
        'child', 'stepchild', 'eligibleFosterChild',
        'siblingOrStepOrHalfSibling', 'descendantOfAChildOrSibling',
        'notAnEarnedIncomeCreditRelationship',
    ],
    // §152(c)(3)(A)(ii) and §152(f)(2) — five calendar months full time.
    earnedIncomeCreditFullTimeStudent: ['wasAFullTimeStudent', 'wasNotAFullTimeStudent'],
    // §152(c)(3)(B), which points at §22(e)(3)'s definition.
    earnedIncomeCreditPermanentAndTotalDisability: [
        'permanentlyAndTotallyDisabled', 'notPermanentlyAndTotallyDisabled',
    ],
    // §152(c)(1)(B), which §32(c)(3)(C) narrows to an abode IN THE UNITED
    // STATES. The stored `livedWithTaxpayer` boolean says neither where nor
    // for how long, which is why this is a separate field rather than a
    // reading of that one.
    earnedIncomeCreditUnitedStatesResidency: [
        'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
        'didNotShareTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
    ],
    // §152(c)(1)(E).
    earnedIncomeCreditJointReturn: ['filedAJointReturn', 'didNotFileAJointReturn'],
    // §32(c)(1)(E) and §32(m) — an SSN valid for employment, issued on or
    // before the return's due date. One vocabulary, two fields, because the
    // filer's and the spouse's are the same question about two people.
    filerSocialSecurityNumber: ['validForEmployment', 'notValidForEmployment'],
    spouseSocialSecurityNumber: ['validForEmployment', 'notValidForEmployment'],
    // §32(c)(1)(B) — an individual who is themselves somebody's qualifying
    // child is not an eligible individual, with or without children of their
    // own.
    filerQualifyingChildOfAnotherTaxpayer: [
        'isAnotherTaxpayersQualifyingChild', 'isNotAnotherTaxpayersQualifyingChild',
    ],
    // §32(c)(1)(A)(ii)(II) — the CHILDLESS credit's age band. Stored as the
    // assertion rather than as an age, because the statute's own test is
    // "attained age 25 but not attained age 65 before the close of the taxable
    // year" and on a joint return it is satisfied if EITHER spouse does; an
    // age number for one person could not express that.
    filerAttainedAgeTwentyFiveButNotSixtyFive: [
        'attainedAgeTwentyFiveButNotSixtyFive', 'didNotAttainAgeTwentyFiveOrHasAttainedSixtyFive',
    ],
    // §32(c)(1)(A)(ii)(I) — the CHILDLESS credit's own abode test, about the
    // filer rather than about a child.
    filerPrincipalPlaceOfAbode: [
        'inTheUnitedStatesForMoreThanHalfTheYear', 'notInTheUnitedStatesForMoreThanHalfTheYear',
    ],
})

/** One key of {@link earnedIncomeCreditVocabularies}.
 * @typedef {keyof typeof earnedIncomeCreditVocabularies} EarnedIncomeCreditFactField
 */

/**
 * The vocabulary check, written ONCE for all ten fields (AGENTS.md, "one
 * rule, one place") rather than ten times.
 *
 * Returns `undefined` for an ABSENT field: absence is a legitimate stored
 * state and a `fjs/schedule/eic` refusal, never a storage error. That is the
 * whole point of the three-state shape — this dialect stores what the
 * taxpayer said, and the consumer decides whether the answer it needs is
 * there.
 * @type {(field: EarnedIncomeCreditFactField) => (stated: string | undefined) => string | undefined}
 */
export const earnedIncomeCreditFactError = field => stated => {
    if (stated === undefined) {
        return undefined
    }
    /** @type {readonly string[]} */
    const permitted = earnedIncomeCreditVocabularies[field]
    if (permitted.some(candidate => candidate === stated)) {
        return undefined
    }
    return `${field} carries ${JSON.stringify(stated)}, which is not one of the `
        + `${permitted.length} values §32 admits: ${permitted.join(', ')}. An unrecognized `
        + 'answer cannot be read as either a yes or a no, and for the earned income credit '
        + 'both readings are wrong for somebody'
}

/**
 * rtti schema for a `return_profile` BLOB. `dialect` is spread first (via
 * `base`) so structural validation reports it as the first failing field on a
 * mismatched blob — DOC-00's criterion-1 discriminant, proven by
 * `proof.crossDialect` below.
 */
export const returnProfileSchema = open({
    ...base(dialect),
    taxYear: number,
    filingStatus: string,
    // Line 12a — someone can claim you (or your spouse) as a dependent.
    claimedAsDependent: or(option, true),
    // Line 12b — married filing separately and your spouse itemizes.
    spouseItemizes: or(option, true),
    // Line 12c — dual-status alien.
    dualStatusAlien: or(option, true),
    // Line 12d — the four age/blindness boxes.
    taxpayerBornBeforeJan2_1961: or(option, true),
    taxpayerIsBlind: or(option, true),
    spouseBornBeforeJan2_1961: or(option, true),
    spouseIsBlind: or(option, true),
    // The i1040gi p33 footnote condition that alone permits a married-filing-
    // separately filer to check the two SPOUSE boxes above. See check 5b.
    spouseHadNoIncomeIsNotFilingAndIsNotADependent: or(option, true),
    dependentCount: number,
    declaredKinds: array(string),
    // Decision 5 — the IRS whole-dollar election, all-or-nothing per return.
    wholeDollarElection: or(option, true),
    // Standard Deduction Worksheet for Dependents input.
    earnedIncome: or(option, string),
    line26EstimatedTaxPayments: or(option, string),
    line35aRefundRequested: or(option, string),
    line36AppliedToNextYear: or(option, string),
    // Schedule 3 line 10 — the amount paid with a Form 4868 request for an
    // automatic extension of time to file. `line26EstimatedTaxPayments`'
    // exact shape, for its exact reason: no information return reports it,
    // because the taxpayer holds a cheque stub rather than a payee statement.
    // See `fjs/schedule/3/todo/amount-paid-with-extension.md`.
    //
    // **Named for SCHEDULE 3's line 10, not a bare `line10`.** The three
    // fields above are named for 1040 lines, so `line10AmountPaid...` would
    // read as 1040 line 10 — the adjustments total, a different figure on a
    // different form. The name says which printed page a reader should open.
    scheduleThreeLine10AmountPaidWithExtensionRequest: or(option, string),
    // Schedule B Part III, line 7a (first sub-question) — TAX-07. Taxpayer-
    // declared; no IRS information return reports this fact.
    hadForeignFinancialAccount: or(option, true),
    // Schedule B Part III, line 7a (second sub-question) — independent of
    // hadForeignFinancialAccount, since the printed form asks it as a
    // separate "if 'Yes'" sub-question rather than a derived consequence.
    requiredToFileFinCen114: or(option, true),
    // Schedule B Part III, line 7b — free-text country names, plural.
    foreignAccountCountries: or(option, array(string)),
    // Schedule B Part III, line 8.
    receivedForeignTrustDistributionOrWasGrantorOrTransferor: or(option, true),
    // Phase 13 Slice 1 (TAX-10), 13-CONTEXT.md Decision 5.1: the IRA-
    // deduction circularity refusal fires on THIS FIELD, not on the coarse
    // `scheduleOneAdjustments` kind — that kind cannot distinguish an IRA
    // deduction (which creates the Pub. 590-A / taxable-Social-Security
    // cycle) from an HSA or educator-expense adjustment, which does not.
    // Read only by `fjs/form1040/core`; no cross-field check needed here.
    iraDeductionDeclared: or(option, true),
    // Phase 13 Slice 1 (TAX-10): the Social Security Benefits Worksheet's
    // line 8 branches on this fact for a married-filing-separately filer —
    // no other 1040 line already carries it. Additive, taxpayer-declared,
    // and read only by `fjs/form1040/core`, mirroring
    // `spouseHadNoIncomeIsNotFilingAndIsNotADependent`'s own precedent: no
    // cross-field check here, since `fjs/form1040/core` gates the value by
    // `filingStatus` itself before ever passing it to the worksheet.
    mfsLivedWithSpouseAtAnyTimeInYear: or(option, true),
    // Schedule A line 18 (TAX-13, 13-CONTEXT.md Decision 2.5) — "elect to
    // itemize deductions even though they are less than your standard
    // deduction". A taxpayer election no document reports, exactly like
    // hadForeignFinancialAccount. Read only by `fjs/tax/deduction`'s
    // `deductionChoice` (13-06); no cross-field check needed here.
    itemizeEvenThoughLessThanStandardDeduction: or(option, true),
    // Form 3903's own pre-line checkbox (§217(g), as left standing when TCJA
    // §11049 suspended §217): "Check here to certify that you meet these
    // requirements" — a Member of the Armed Forces on active duty moving,
    // under a military order, because of a permanent change of station. A
    // taxpayer certification no information return states, exactly like
    // `itemizeEvenThoughLessThanStandardDeduction`. Read only by
    // `fjs/schedule/1`, which gates line 14 on it; no cross-field check here,
    // because certifying eligibility while claiming nothing is an ordinary
    // return and every other field on this dialect is silent about moving.
    movingExpensesArmedForcesPermanentChangeOfStation: or(option, true),
    // Form 4797 line 7's own printed instruction, which names this state in so
    // many words: "If line 7 is a gain and you didn't have any prior year
    // section 1231 losses, or they were recaptured in an earlier year, enter
    // the gain from line 7 as a long-term capital gain on the Schedule D filed
    // with your return and skip lines 8, 9, 11, and 12."
    //
    // §1231(c) recharacterizes a current-year net §1231 gain as ordinary to
    // the extent of "your net section 1231 losses deducted during the 5
    // preceding tax years that have not yet been applied against any net
    // section 1231 gain" (i4797 p6, line 8) — five prior years plus the
    // running ledger of what has already been applied. `vnd.fjs.prior_year_\
    // capital_loss` is the precedent for transcribing a prior-year fact and it
    // is a precedent AGAINST transcribing this one: that dialect stores "ONLY
    // the four raw prior-year figures, never a pre-computed carryover total",
    // and line 8 has no raw printed figures behind it — i4797 p7 calls it a
    // "For recordkeeping purposes" amount. So a checkbox, in
    // `movingExpensesArmedForcesPermanentChangeOfStation`'s exact shape.
    //
    // **It belongs on THIS dialect and not on `vnd.fjs.asset_register`, and
    // the cardinality is the argument.** §1231 nets across the whole return; a
    // taxpayer with two businesses files two Forms 4562 (i4562 p1: "File a
    // separate Form 4562 for each business or activity") and holds two
    // registers, but exactly ONE Form 4797 and one netting. A per-register
    // certification would be a return-level fact stored per business, with two
    // copies free to disagree.
    //
    // Read only by `fjs/form4797`, which REFUSES at printed line 8 without it
    // — and only when line 7 is a GAIN, because the printed page skips lines 8
    // and 9 entirely for a loss. See
    // `fjs/form4797/todo/sales-of-business-property.md` §4.
    noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears: or(option, true),
    // §904(j)(2)(C)'s ELECTION and §904(j)(2)(A)'s ASSERTION, in one field,
    // and the name states both because the taxpayer is making both claims at
    // once: "every dollar of my foreign-source gross income is qualified
    // passive income — passive under §904(d)(2)(B) and shown on a payee
    // statement furnished to me (§904(j)(3)(A)) — and I elect to have §904(j)
    // apply." Read by `fjs/schedule/3`, which computes Schedule 3 line 1
    // without Form 1116 when it is present and REFUSES the return when a
    // foreign tax is stored and it is not. See
    // `fjs/schedule/3/todo/foreign-tax-credit.md`.
    //
    // **The engine can check exactly one of §904(j)(2)'s three conditions.**
    // (B), the $300/$600 ceiling on creditable foreign taxes, is arithmetic
    // over stored boxes and `fjs/schedule/3` performs it. (A) is not
    // observable at all: neither `vnd.fjs.1099div` nor `vnd.fjs.1099int`
    // states how much of its box 1a or box 1 was foreign-source, nor which
    // §904(d) category it fell in, and no document reports the foreign wages
    // or rents that would break the condition. (C) is not a fact but a
    // choice, and a costly one — §904(j)(1)(C) forbids carrying any of an
    // electing year's excess taxes back or forward under §904(c). So this
    // flag is a taxpayer ASSERTION, exactly like
    // `spouseHadNoIncomeIsNotFilingAndIsNotADependent` above, and it is what
    // makes the resulting credit attributable to a declaration rather than to
    // an assumption. **A small stored figure is not evidence that (A)
    // holds.**
    //
    // ONE field rather than two, because only one combination is actionable:
    // asserted-but-not-elected means Form 1116, which this engine refuses,
    // and elected-without-the-facts is not a state a taxpayer can truthfully
    // be in. No cross-field check here, on
    // `movingExpensesArmedForcesPermanentChangeOfStation`'s own precedent:
    // electing while holding no 1099 with a foreign tax box is an ordinary
    // return, and every other field on this dialect is silent about foreign
    // taxes.
    section904jElectionAllForeignIncomeIsQualifiedPassiveIncome: or(option, true),
    // TAX-12 (13-CONTEXT.md Decision 4.1) — per-dependent facts Schedule
    // 8812 needs to classify a qualifying child versus an other dependent.
    // Additive, ABSENT for a return declaring `dependentCount: 0` and
    // itemizing nothing about its dependents (check 8 below). See this
    // module's own docstring, "schema decisions worth stating", for why
    // citizenship is deliberately NOT a fifth field here.
    dependents: or(option, array(dependentEntrySchema)),
    // TAX-27 (Phase 32) — §32(c)(1)'s and §32(m)'s facts about the FILER,
    // none of which any information return reports and none of which any
    // existing field on this dialect carries. See
    // {@link earnedIncomeCreditVocabularies}.
    //
    // §32(c)(1)(A)(ii)(III)'s third childless-credit condition -- "is not a
    // dependent for whom a deduction is allowable ... to another taxpayer" --
    // deliberately gets NO field here: `claimedAsDependent` (1040 line 12a,
    // far above) already carries exactly that fact, and a second declaration
    // of one fact is how the two come to disagree.
    filerSocialSecurityNumber: or(option, string),
    spouseSocialSecurityNumber: or(option, string),
    filerQualifyingChildOfAnotherTaxpayer: or(option, string),
    filerAttainedAgeTwentyFiveButNotSixtyFive: or(option, string),
    filerPrincipalPlaceOfAbode: or(option, string),
    // TAX-37 (Form 8962) -- the two facts the Premium Tax Credit needs that
    // no information return reports. A Form 1095-A is a REAL issued statement
    // and carries neither: the Marketplace does not know which federal
    // poverty line table the filer's residence selects, and it certainly does
    // not know whether a dependent has to file a return.
    //
    // Form 8962 line 4's own printed checkbox: Alaska, Hawaii, or the other
    // 48 states and DC. A vocabulary-checked STRING rather than three
    // `or(option, true)` flags, because the printed form admits exactly one of
    // three and three independent booleans could say "Alaska and Hawaii" --
    // the same reason the §32 fact fields above are vocabulary strings.
    //
    // **A declaration of which TABLE applies, not of a state**, because
    // i8962's line 4 instruction is itself about the table: a filer who moved
    // during the year, or a joint filer whose spouses lived in different
    // states, uses "the table with the higher dollar amounts for your family
    // size" -- an answer no state name determines. Read only by
    // `fjs/form1040/core`, which passes it to `fjs/form8962`; that form
    // REFUSES when it is absent and a Form 1095-A is stored, so no
    // cross-field check is needed here (buying Marketplace coverage in no
    // year is an ordinary return, and every other field on this dialect is
    // silent about health coverage).
    federalPovertyLineTable: or(option, string),
    // Form 8962 line 2b: household income includes "the combined modified AGI
    // for your dependents who are required to file an income tax return
    // because their income meets the income tax return filing threshold".
    // `or(option, true)`, DOC-12 -- absent means NOT certified, and
    // `fjs/form8962` then refuses a return with any dependent rather than
    // reading line 2b as zero, which would overstate the credit for every
    // family whose teenager has a job.
    //
    // The certification is exactly the printed condition, not a proxy for it:
    // the taxpayer states that no dependent meets the §6012(a)(1) filing
    // threshold, which for the ordinary case (a six-year-old) is trivially
    // true and which the taxpayer, unlike this engine, actually knows.
    noDependentIsRequiredToFileAnIncomeTaxReturn: or(option, true),
    // TAX-39 (Form 7206) -- §162(l)(2)(B)'s "other coverage" disqualifier, the
    // one fact the self-employed health insurance deduction needs that appears
    // on NO information return and that no amount this engine holds implies.
    //
    // The statute, 26 U.S.C. §162(l)(2)(B): "Paragraph (1) shall not apply to
    // any taxpayer for any calendar month for which the taxpayer is eligible
    // to participate in any subsidized health plan maintained by any employer
    // of the taxpayer or of the spouse of, or any dependent, or individual
    // described in subparagraph (D) of paragraph (1) with respect to, the
    // taxpayer." Form 7206 line 1 restates it as an exclusion from the
    // premiums themselves: "don't include ... Amounts for any month you were
    // eligible to participate in a health plan subsidized by your employer or
    // your spouse's employer or the employer of either your dependent or your
    // child who was under the age of 27 at the end of 2025."
    //
    // **The certification is WHOLE-YEAR while the statute is month-by-month,
    // and that is a deliberate narrowing rather than an approximation.** A
    // taxpayer eligible for an employer plan in three of twelve months has a
    // real, partial deduction; they cannot make this declaration, and
    // `fjs/schedule/1` then REFUSES rather than computing one. Refusing a
    // return this engine cannot compute is the honest direction; a whole-year
    // flag read as "eligible in no month" when the taxpayer meant "eligible in
    // some" would overstate the deduction, which is the direction that costs
    // the taxpayer a notice.
    //
    // It is also broader than §162(l)(2)(B) in a second way: the statute
    // applies the test SEPARATELY to long-term-care plans and to plans that
    // are not long-term-care ones (Form 7206 line 2's note), and this one flag
    // covers both. A filer eligible for one but not the other cannot certify,
    // and again refuses rather than deducting. Both narrowings are recorded in
    // `fjs/schedule/1/todo/self-employed-health-insurance.md`.
    //
    // `or(option, true)`, DOC-12 -- absent means NOT certified. Read only by
    // `fjs/schedule/1`, which refuses when premiums are stored and it is
    // absent, so no cross-field check is needed here: certifying while
    // claiming no premium is an ordinary return, exactly as
    // `movingExpensesArmedForcesPermanentChangeOfStation`'s own note says of
    // certifying a permanent change of station while claiming no move.
    notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth: or(option, true),
    // ── TAX-42 (Form 2555, §911): four facts, none on any information return ─
    //
    // There is no information return for foreign earned income AT ALL. A
    // foreign employer issues no Form W-2, and Form 2555 Part IV lines 19
    // through 23 are the taxpayer's own tally of wages, non-cash lodging,
    // meals, a car, allowances and reimbursements. So all four arrive the way
    // a household move's cost does -- stated, because nobody else states them.
    //
    // They ride on THIS dialect rather than on `vnd.fjs.adjustments` because
    // Form 2555 line 45 lands in Schedule 1 **Part I** (line 8d, additional
    // income), and that dialect is Part II's. See
    // `fjs/form2555/todo/foreign-earned-income.md` §7.
    //
    // §911(d)(1)(B)'s physical presence test, together with §911(d)(3)'s tax
    // home test, in ONE declaration -- because a taxpayer claiming the
    // exclusion is making both claims at once and neither is worth anything
    // alone:
    //
    // > "I was physically present in a foreign country or countries for at
    // > least 330 full days during a period of 12 consecutive months, my tax
    // > home was in a foreign country throughout my qualifying period, and I
    // > maintained no abode in the United States during that period."
    //
    // **The 330-day half is a COUNT**, which is what makes it certifiable at
    // all: i2555 p3 defines a full day as "the 24-hour period that starts at
    // midnight", and on any given midnight-to-midnight day a person either was
    // or was not inside a foreign country. That is the same kind of fact as
    // `movingExpensesArmedForcesPermanentChangeOfStation`'s military order --
    // the taxpayer holds the evidence and nobody else does, because no
    // information return reports travel.
    //
    // **The abode half is deliberately NARROWER than §911(d)(3).** The statute
    // denies a foreign tax home "for any period for which his abode is within
    // the United States", and i2555 p2 makes that a weighing of "family,
    // economic, and personal ties" -- a judgement an ordinary taxpayer is not
    // competent to make, and the instructions' own offshore-oil-rig example is
    // a filer with well over 330 days abroad who still fails it. So this field
    // asks for the bright line underneath instead. A filer who kept a home in
    // the United States may still qualify under the statute; they cannot make
    // this declaration and are refused, which is the
    // `notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth` trade exactly:
    // a certification easier to state truthfully than the statute is to
    // satisfy, so everyone who CAN state it truthfully certainly qualifies.
    //
    // **§911(d)(1)(A)'s bona fide residence test gets NO field here**, and
    // that is the decision this phase turned on rather than an omission. It
    // depends on "your intention about the length and nature of your stay",
    // and i2555 p3 continues: "If these conflict, your acts carry more weight
    // than your words." A certification IS words. An instruction whose own
    // text discounts them cannot be turned into a checkbox, so
    // `foreignEarnedIncomeBonaFideResidenceTest` refuses by name instead.
    //
    // `or(option, true)`, DOC-12 -- absent means NOT certified. Check 11 below is
    // what makes absence bite, because unlike the certifications above this
    // one sits beside stored AMOUNTS on the same dialect.
    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: or(option, true),
    // Form 2555 line 31/38, and i2555's line 31 instruction defines it
    // exactly: "the number of days in your qualifying period that fall within
    // your 2025 tax year. Your qualifying period is the period during which
    // you meet the tax home test and either the bona fide residence or
    // physical presence test."
    //
    // **Not the 330 full days and not line 16's 12-month window.** A filer
    // abroad continuously from 2023 to 2027 enters 365 here while their line
    // 16 window is a 12-month slice; i2555's own example -- a tax home
    // established August 14 and held past year end -- enters 140.
    //
    // `or(option, number)` on `vnd.fjs.rental_property`'s precedent, where
    // `fairRentalDays` and `personalUseDays` are day counts and ABSENT is not
    // zero. Range-checked in check 11 against that dialect's own
    // {@link daysInTheLongestYear}, for its reason: this dialect does not know
    // whether the year it names is a leap year, and 366 is the bound that is
    // safe in every year. The tighter bound -- the actual length of the tax
    // year -- is `fjs/tax/params`' `foreignEarnedIncome.daysInTaxYear`, and
    // `fjs/schedule/1` refuses against THAT, because a parameter set is where
    // a year's own facts live.
    foreignEarnedIncomeQualifyingDays: or(option, number),
    // Form 2555 line 26 -> line 27, the 2025 foreign earned income itself, a
    // money box. Already NET of line 25's §119 excludable meals and lodging,
    // exactly as `fjs/form7206`'s line 1 premiums arrive net of that line's
    // own printed exclusions: the split cannot be recovered downstream, so it
    // is enforced where the figure is named.
    foreignEarnedIncome: or(option, string),
    // Form 2555 line 44 -- "Deductions allowed in figuring your adjusted gross
    // income (Form 1040 or 1040-SR, line 11) that are allocable to the
    // excluded income", which is §911(d)(6) in its deduction half. A money
    // box, absent meaning $0, which the printed line permits (it is left blank
    // by every filer with none).
    //
    // Understating it OVERSTATES the exclusion, so it is not a safe field to
    // omit -- which is why check 11 refuses a stored foreign earned income
    // that arrives without the certification, and why this field exists at all
    // rather than being assumed away.
    foreignEarnedIncomeDeductionsAllocableToExcludedIncome: or(option, string),
    // The Foreign Earned Income Tax Worksheet's own line 2b, printed
    // identically in i1040gi p37 (the 1040 line 16 worksheet) and i6251 p10
    // (the Form 6251 line 7 one): "the total amount of any itemized deductions
    // or exclusions you couldn't claim because they are related to excluded
    // income".
    //
    // **A DIFFERENT figure from
    // `foreignEarnedIncomeDeductionsAllocableToExcludedIncome` above, and the
    // names say which is which.** That one is Form 2555 line 44 -- deductions
    // taken in figuring ADJUSTED GROSS INCOME, which reduce the exclusion
    // itself. This one is below the line: itemized deductions and exclusions,
    // which reduce the amount the tax worksheet stacks the remaining income on
    // top of. Folding them into one field would subtract the same dollars
    // twice on two different lines of two different forms.
    //
    // Absent means $0, which the printed line permits -- it is left blank by
    // every filer with none, and every filer taking the standard deduction has
    // no itemized deduction to be disallowed. Omitting it OVERSTATES the tax
    // rather than understating it: worksheet line 2c grows, and line 6 is
    // increasing in line 2c under a progressive schedule. That is the safe
    // direction and still not a reason to guess, which is why the field exists.
    foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed: or(option, string),
})

/** @typedef {Ts<typeof returnProfileSchema>} ReturnProfile */

/**
 * The three federal-poverty-line tables Form 8962 line 4 prints as checkboxes,
 * frozen here the way {@link earnedIncomeCreditVocabularies} freezes §32's
 * answers. `fjs/tax/params` stores a table under each of these exact names,
 * and `fjs/form8962`'s own proof is what pins the two lists to each other --
 * a value this dialect accepted but that module had no table for would refuse
 * deep inside a computation instead of at ingest, which is the whole reason
 * check 10 below exists.
 * @type {readonly string[]}
 */
const federalPovertyLineTableNames = [
    'contiguous48AndDistrictOfColumbia',
    'alaska',
    'hawaii',
]

/**
 * The five Form 2555 fields this dialect carries, walked in check 11's loop so
 * the declared-kind pairing is written once rather than five times — the
 * {@link moneyBoxFields} idiom, and what check 7b's own comment says to do
 * once a third such field arrives.
 *
 * Typed `@type {const}` — not a wider `keyof ReturnProfile` annotation — so
 * `r[field]` resolves to exactly `string | number | true | undefined` rather
 * than the union of every field's type, the same device {@link moneyBoxFields}
 * uses.
 */
const formTwoFiveFiveFiveFields = /** @type {const} */ ([
    'physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode',
    'foreignEarnedIncomeQualifyingDays',
    'foreignEarnedIncome',
    'foreignEarnedIncomeDeductionsAllocableToExcludedIncome',
    'foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed',
])

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
    'scheduleThreeLine10AmountPaidWithExtensionRequest',
    'foreignEarnedIncome',
    'foreignEarnedIncomeDeductionsAllocableToExcludedIncome',
    'foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed',
])

/**
 * The five {@link earnedIncomeCreditVocabularies} keys that name a field on
 * the PROFILE, walked in a loop so the vocabulary check is written once.
 * Typed `@type {const}` — not a wider annotation — so `r[field]` resolves to
 * exactly `string | undefined`, the same device {@link moneyBoxFields} uses.
 */
const filerFactFields = /** @type {const} */ ([
    'filerSocialSecurityNumber',
    'spouseSocialSecurityNumber',
    'filerQualifyingChildOfAnotherTaxpayer',
    'filerAttainedAgeTwentyFiveButNotSixtyFive',
    'filerPrincipalPlaceOfAbode',
])

/** The five that name a field on a {@link dependentEntrySchema} entry. */
const dependentFactFields = /** @type {const} */ ([
    'earnedIncomeCreditRelationship',
    'earnedIncomeCreditFullTimeStudent',
    'earnedIncomeCreditPermanentAndTotalDisability',
    'earnedIncomeCreditUnitedStatesResidency',
    'earnedIncomeCreditJointReturn',
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
 * 7b. The identical rule for Schedule 3 line 10's own amount.
 * 8. A present `dependents` array's length equals `dependentCount`.
 * 9. Every PRESENT §32 fact — five on the filer, five per dependent — names a
 *    value {@link earnedIncomeCreditVocabularies} admits.
 * 10. A PRESENT `federalPovertyLineTable` names one of Form 8962 line 4's
 *    three prints.
 * 11. Every dependent's `ageAtYearEnd` is a whole number in
 *    `0 .. {@link oldestPlausibleDependentAge}`.
 * 12. Every present Form 2555 field has `'foreignEarnedIncomeExclusion'` declared.
 * 13. A present `foreignEarnedIncomeQualifyingDays` is a whole count no larger
 *     than {@link daysInTheLongestYear}.
 * 14. A present `foreignEarnedIncome` carries both §911(d)(1)(B)'s certification
 *     and a qualifying-day count.
 *
 * This list enumerated 1–8 only, omitting 7b, 9 and 10, from the day check 7b
 * landed until 2026-08-19 — the same documentation drift the leaf-name sweep
 * has now found nine times. The body is the authority; a reader who trusted
 * this list would have concluded that a present §32 fact and a present
 * poverty-line table were unchecked, which is the direction that costs
 * something. **Checks 12 through 14 were written as 11 through 13 on a branch
 * that could not see check 11**, and are renumbered here rather than
 * renumbered around: the numbers are cited from this module's own docstrings
 * and proof-leaf names, and the citations move with them.
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
    // 7b — the identical rule for Schedule 3 line 10's own amount, which
    // arrived on this dialect for the identical reason (no information return
    // reports a Form 4868 payment). Written as a second `if` rather than
    // folded into a table because there are two of them, and a table of two
    // is harder to read than two statements; the day a third arrives, make it
    // a loop the way `moneyBoxFields` is one.
    if (
        r.scheduleThreeLine10AmountPaidWithExtensionRequest !== undefined
        && !r.declaredKinds.includes('amountPaidWithExtensionRequest')
    ) {
        return error(
            'scheduleThreeLine10AmountPaidWithExtensionRequest is present but declaredKinds '
            + "does not name 'amountPaidWithExtensionRequest'",
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
    // 9 — TAX-27: every PRESENT §32 fact names a value that vocabulary
    // admits. The five filer fields first, then the five per-dependent ones
    // with the entry's index named, so a refusal on a five-dependent return
    // says WHICH dependent.
    for (const field of filerFactFields) {
        const message = earnedIncomeCreditFactError(field)(r[field])
        if (message !== undefined) {
            return error(message)
        }
    }
    for (const [index, entry] of (r.dependents ?? []).entries()) {
        for (const field of dependentFactFields) {
            const message = earnedIncomeCreditFactError(field)(entry[field])
            if (message !== undefined) {
                return error(`dependents[${index}]: ${message}`)
            }
        }
    }
    // 10 — TAX-37: a PRESENT federal-poverty-line table names one of the
    // three Form 8962 line 4 prints. Refused at ingest rather than at the
    // form, because an unrecognized answer cannot be read as any of the three
    // and the three differ by up to 25% of the poverty line.
    if (
        r.federalPovertyLineTable !== undefined
        && !federalPovertyLineTableNames.includes(r.federalPovertyLineTable)
    ) {
        return error(
            `federalPovertyLineTable carries ${JSON.stringify(r.federalPovertyLineTable)}, which `
            + `is not one of the ${federalPovertyLineTableNames.length} tables Form 8962 line 4 `
            + `prints: ${federalPovertyLineTableNames.join(', ')}`,
        )
    }
    // 11 — every dependent's age is a whole number of years in range. See
    // {@link oldestPlausibleDependentAge} for the bound and for the $1,700
    // this check was measured to be worth.
    //
    // ONE field, so ONE statement inside the loop that already exists for
    // every per-dependent check — deliberately NOT the `[name, value]` table
    // `moneyBoxFields` and `fjs/document/rental_property`'s two day counts
    // use. That device pays when a rule is written more than once; a table of
    // one is the check-7b judgement in the other direction. The loop over
    // `dependents` IS the DRY device here.
    //
    // Appended rather than inserted beside check 8, where it belongs by
    // subject: these numbers are cited from this module's docstrings and
    // from its proof leaf names, and renumbering 9 and 10 to make room would
    // break those citations for nothing a reader gains.
    for (const [index, entry] of (r.dependents ?? []).entries()) {
        const age = entry.ageAtYearEnd
        if (!Number.isInteger(age) || age < 0 || age > oldestPlausibleDependentAge) {
            return error(
                `dependents[${index}]: ageAtYearEnd ${age} is not a whole number of years in `
                + `0..${oldestPlausibleDependentAge} — Schedule 8812 line 4 splits the $2,000 `
                + `child tax credit from the $500 other-dependent credit on "under age 17", and `
                + `§152(c)(3) tests 19 and 24 for the earned income credit, so a fractional or `
                + `out-of-range age would decide those comparisons on a number that is not an `
                + `age at all`,
            )
        }
    }
    // 12 — TAX-42: an amount or a day count with no declared kind is exactly
    // check 7's failure mode on a different line. All four Form 2555 fields
    // route through ONE loop rather than four `if`s, which is what check 7b's
    // own comment says to do the day a third arrives: "make it a loop the way
    // `moneyBoxFields` is one."
    for (const field of formTwoFiveFiveFiveFields) {
        if (r[field] !== undefined && !r.declaredKinds.includes('foreignEarnedIncomeExclusion')) {
            return error(
                `${field} is present but declaredKinds does not name `
                + "'foreignEarnedIncomeExclusion'",
            )
        }
    }
    // 13 — the day count is a whole number of days that could fall inside a
    // tax year. Bounded by `vnd.fjs.rental_property`'s own
    // {@link daysInTheLongestYear}, IMPORTED rather than re-declared: 366 in
    // every year for that dialect's stated reason, which is this dialect's
    // reason too. The tighter bound — the actual length of THIS tax year — is
    // `fjs/tax/params`' `foreignEarnedIncome.daysInTaxYear`, and
    // `fjs/schedule/1` refuses against that; a parameter set is where a year's
    // own facts live, and this dialect is not.
    const qualifyingDays = r.foreignEarnedIncomeQualifyingDays
    if (
        qualifyingDays !== undefined
        && (!Number.isInteger(qualifyingDays)
            || qualifyingDays < 0
            || qualifyingDays > daysInTheLongestYear)
    ) {
        return error(
            `foreignEarnedIncomeQualifyingDays must be a whole count of days from 0 to `
            + `${daysInTheLongestYear}: ${qualifyingDays}`,
        )
    }
    // 14 — §911(a) allows the exclusion only to a "qualified individual", and
    // §911(b)(2)(A) prorates it by the qualifying period. A stored foreign
    // earned income without BOTH is an amount this engine could only exclude
    // by assuming a qualification nobody claimed or a day count nobody
    // supplied — and assuming 365 days would hand a filer who qualified for
    // three months the whole $130,000.
    //
    // Refused HERE rather than at the form, because both missing facts are
    // visible on this one document and a refusal at ingest names the document
    // the taxpayer must fix.
    if (r.foreignEarnedIncome !== undefined) {
        if (r.physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode === undefined) {
            return error(
                'foreignEarnedIncome is present but '
                + 'physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode '
                + 'is not declared: §911(d)(1)(A) bona fide residence is a refused kind, so the '
                + 'physical presence test is the only route to the exclusion this engine models',
            )
        }
        if (qualifyingDays === undefined) {
            return error(
                'foreignEarnedIncome is present but foreignEarnedIncomeQualifyingDays is absent: '
                + 'Form 2555 line 38 prorates the exclusion by the qualifying days that fall '
                + 'within the tax year, and an absent count is not 365',
            )
        }
    }
    return ok(r)
}

/**
 * Validates an already-parsed JSON value as a `return_profile` BLOB:
 * structural (rtti) validation followed by the semantic checks in
 * {@link checkReferences}.
 *
 * Dialect discrimination happens exclusively through `validateShape`'s
 * exact-literal match on `returnProfileSchema`'s `dialect` member — an already-parsed
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
 * without anyone noticing — the field stays `or(option, string)` structurally, so
 * a comma-grouped amount in a dropped box would then validate as ok. One
 * generated leaf per NAMED box supplies a comma-grouped value to that box
 * alone, asserts `validate` refuses, AND asserts the refusal names that box,
 * so the leaf cannot pass because some unrelated check fired first.
 *
 * The fixture declares `'estimatedTaxPayments'` deliberately: without it, the
 * `line26EstimatedTaxPayments` leaf would be satisfied by cross-field check 7
 * rather than by the exactness loop it is meant to exercise. It declares
 * `'amountPaidWithExtensionRequest'` for the same reason and against the same
 * hazard one check later — check 7b. **Every kind a check 7-shaped guard pairs
 * with a money box on this dialect belongs in this list**, or that box's leaf
 * silently stops testing exactness and starts testing the guard.
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
                declaredKinds: [
                    'estimatedTaxPayments',
                    'amountPaidWithExtensionRequest',
                    'foreignEarnedIncomeExclusion',
                ],
                physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
                foreignEarnedIncomeQualifyingDays: 365,
                [field]: '1,234.56',
            })
            assertEq(t, 'error', ['expected a comma-grouped amount in this box to be refused', field, t, v])
            assert(typeof v === 'string', ['expected a semantic string refusal', field, v])
            assert(v.includes(field), ['expected the refusal to name the offending box', field, v])
        },
    ]),
)

/**
 * A profile stating ALL TEN §32 facts, each from its own vocabulary — the
 * control for the ten generated refusals below, and the fixture
 * `fjs/schedule/eic` is built to compute for.
 * @type {ReturnProfile}
 */
const everyFactStated = {
    ...minimal,
    dependentCount: 1,
    dependents: [{
        relationship: 'daughter',
        ssnValidForEmployment: true,
        ageAtYearEnd: 9,
        livedWithTaxpayer: true,
        earnedIncomeCreditRelationship: 'child',
        earnedIncomeCreditFullTimeStudent: 'wasNotAFullTimeStudent',
        earnedIncomeCreditPermanentAndTotalDisability: 'notPermanentlyAndTotallyDisabled',
        earnedIncomeCreditUnitedStatesResidency:
            'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
        earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
    }],
    filerSocialSecurityNumber: 'validForEmployment',
    spouseSocialSecurityNumber: 'validForEmployment',
    filerQualifyingChildOfAnotherTaxpayer: 'isNotAnotherTaxpayersQualifyingChild',
    filerAttainedAgeTwentyFiveButNotSixtyFive: 'attainedAgeTwentyFiveButNotSixtyFive',
    filerPrincipalPlaceOfAbode: 'inTheUnitedStatesForMoreThanHalfTheYear',
}

/**
 * One generated leaf per §32 fact field: the SAME rejected value
 * (`'sortOf'`, a word no vocabulary contains) put in that field alone,
 * asserting `validate` refuses AND that the refusal names the offending
 * field. Naming matters here for the same reason it does in
 * {@link generatedMoneyBoxExactnessProof}: without it a leaf could pass
 * because some unrelated check fired first.
 *
 * A dependent-level field is exercised through a one-entry `dependents`
 * array; a filer-level one directly. Which is which is decided by
 * {@link dependentFactFields}, so a field that moved between the two loops in
 * `checkReferences` without moving here would leave its leaf testing nothing
 * — hence {@link expectedEarnedIncomeCreditFactFieldCount} and the two
 * hand-typed halves beside it.
 * @type {{ readonly [field: string]: () => void }}
 */
const generatedEarnedIncomeCreditVocabularyProof = Object.fromEntries(
    Object.keys(earnedIncomeCreditVocabularies).map(field => [
        field,
        () => {
            /** @type {readonly string[]} */
            const perDependent = dependentFactFields
            const [t, v] = validate(perDependent.includes(field)
                ? {
                    ...minimal,
                    dependentCount: 1,
                    dependents: [{ relationship: 'x', ageAtYearEnd: 5, [field]: 'sortOf' }],
                }
                : { ...minimal, [field]: 'sortOf' })
            assertEq(t, 'error', ['expected an unrecognized §32 answer to be refused', field, t, v])
            assert(typeof v === 'string', ['expected a semantic string refusal', field, v])
            assert(v.includes(field), ['expected the refusal to name the offending field', field, v])
            assert(v.includes('sortOf'), ['expected the refusal to quote the offending value', field, v])
        },
    ]),
)

/**
 * Independently hand-typed: how many §32 fact fields
 * {@link earnedIncomeCreditVocabularies} carries. Deliberately NOT
 * `Object.keys(...).length` — that is the code under test, and a field
 * dropped from it would take its own generated leaf with it, leaving the loop
 * above iterating one fewer and green.
 *
 * Five per dependent (§32(c)(3)'s relationship, student status, disability,
 * United States residency and joint-return facts) and five about the filer
 * (§32(m)'s two social security numbers, §32(c)(1)(B)'s qualifying-child
 * question, and §32(c)(1)(A)(ii)'s age band and abode). Counted off the
 * statute, not off the object.
 * @type {number}
 */
const expectedEarnedIncomeCreditFactFieldCount = 10

/**
 * Independently hand-typed: the number of money boxes
 * {@link moneyBoxFields} names today. Deliberately NOT
 * `moneyBoxFields.length` — if it were, dropping a box would shrink both
 * sides together and this check could never fail. The duplication is the
 * mechanism, not a smell (AGENTS.md).
 *
 * `4 -> 5` is Schedule 3 line 10's own
 * `scheduleThreeLine10AmountPaidWithExtensionRequest`: the FIRST money box on
 * this dialect that is not a 1040 line, and the fourth figure this engine
 * takes from the taxpayer because no information return states it.
 *
 * `5 -> 8` is TAX-42's three — Form 2555 lines 26 and 44, and the Foreign
 * Earned Income Tax Worksheet's own line 2b. The first money boxes here that
 * are not a 1040 or a schedule line at all, but a form's and a worksheet's.
 * They are on this dialect for the reason their own comments give: there is no
 * information return for foreign earned income anywhere.
 * @type {number}
 */
const expectedMoneyBoxFieldCount = 8

/**
 * Independently hand-typed: the number of Form 2555 fields
 * {@link formTwoFiveFiveFiveFields} names today, and therefore the number
 * check 11's loop walks. Deliberately NOT `formTwoFiveFiveFiveFields.length`,
 * for {@link expectedMoneyBoxFieldCount}'s reason — a field dropped from that
 * list would vanish from the loop AND from
 * `everyFormTwoFiveFiveFiveFieldNeedsTheDeclaredKind`'s own five cases in the
 * same instant, and neither would notice. This constant is what does.
 * @type {number}
 */
const expectedFormTwoFiveFiveFiveFieldCount = 5

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
 *
 * `110 -> 114` is Phase 30's own (DOC-24/TAX-35), and it IS a split — the
 * seventh, and the one that contradicts the paragraph five above which called
 * Phase 27's "really the last". It was the last split of a coarse kind
 * covering many printed LINES; this one takes apart a kind covering ONE
 * printed line whose single caption names five different schedules-within-a-
 * schedule. `rentalRealEstateRoyaltiesPartnershipsSCorps` is removed and five
 * per-Schedule-E-PART kinds added, `110 - 1 + 5`. Five rather than six
 * because Schedule E's line 41 is Part V's own total — see the vocabulary's
 * own comment above.
 *
 * **The lesson is stated here rather than left to be relearned**: "one kind
 * per printed line" is the rule Phases 23 through 27 applied, and it is not
 * quite the rule. The real rule is one kind per thing a taxpayer can
 * truthfully declare having, and printed Schedule 1 line 5 is five of those.
 *
 * `115 -> 117` is TAX-37's own, and it is the EIGHTH split, of exactly the
 * shape the paragraph above describes: `advancePremiumTaxCreditAndOtherRepayments`
 * covered one printed line (Schedule 2 line 1) whose lettered sub-lines are
 * three unrelated things a taxpayer can truthfully declare having — an excess
 * advance premium tax credit (Form 8962), a clean vehicle credit transferred
 * to a dealer (Form 8936 Schedule A), and an elective payment election
 * recapture (Form 4255). One is removed and three added, `115 - 1 + 3`.
 *
 * **The split is what made reclassification safe**, and that is worth stating
 * because the alternative looked cheaper. Form 8962 computes line 1a and
 * nothing computes 1b through 1f; had the coarse kind simply become modeled,
 * a taxpayer whose only Part I entry was a clean-vehicle repayment would have
 * declared the exact kind the engine had just started computing and been
 * handed a zero. Splitting is the only move that lets the engine say yes to
 * one and no to the others.
 *
 * **195 -> 197 is TAX-38's**, and it is the first widening since that split:
 * Form 6781 Part I made §1256 contracts computable from Form 1099-B box 11,
 * and `straddleGainsAndLosses` and
 * `netSectionTwelveFiftySixContractsLossCarryback` name the two parts of that
 * form which are not. Both join `unmodeledKindRefusals`; nothing joins
 * `modeledKinds`, and nothing is reclassified. Before it, a futures trader
 * had no kind at all to declare and fell through the scope guard entirely.
 *
 * **197 -> 201 is TAX-42's**, and it is a SPLIT rather than a widening:
 * `foreignEarnedIncomeForm2555` named three printed destinations under one
 * row on the stated ground that "one form produces them", and that was right
 * while nothing was modelled and wrong the moment something was. It becomes
 * four — `foreignEarnedIncomeExclusion` (modeled),
 * `foreignEarnedIncomeBonaFideResidenceTest`,
 * `foreignHousingExclusionOrDeduction`,
 * `foreignEarnedIncomeReceivedInAnotherTaxYear` and
 * `foreignEarnedIncomeCapitalGainExcess` (all refused) — so `197 - 1 + 5`.
 * The four refusals have four unrelated blockers, and under the old row a
 * filer with no housing claim was refused by a sentence about a table they
 * never needed.
 *
 * **The last of the four is a CONDITION this engine detects, not a fact a
 * filer would think to declare** — and that is not new here. `fjs/tax/line16`
 * has raised `childsUnearnedIncomeForm8615` and `investmentInterestForm4952`
 * off computed conditions since Phase 10; a kind is a thing the engine can
 * NAME, and being declarable is what most of them additionally are.
 * @type {number}
 */
const expectedKindCount = 201

export const proof = {
    dialectAndMediaType: () => {
        assertEq(dialect, 'vnd.fjs.return_profile')
        assertEq(mediaType, 'application/vnd.fjs.return_profile+json')
    },
    kindVocabularyIsExactlyTwoHundredAndOne: () => {
        assertEq(kindVocabulary.length, expectedKindCount)
        assertEq(new Set(kindVocabulary).size, kindVocabulary.length)
    },
    thereAreExactlyFiveFormTwoFiveFiveFiveFields: () => {
        assertEq(formTwoFiveFiveFiveFields.length, expectedFormTwoFiveFiveFiveFieldCount)
        assertEq(
            new Set(formTwoFiveFiveFiveFields).size, formTwoFiveFiveFiveFields.length,
            'and each is named once')
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
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError, got a checkReferences string', v])
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
        /**
         * Check 11. `ageAtYearEnd` was a required, entirely unvalidated
         * `number` on {@link dependentEntrySchema} until 2026-08-19: `-3`,
         * `9.5` and `1e308` all validated `ok`, and every one of them then
         * decided a credit. Measured on the tree immediately before the check
         * landed, one dependent and a $50,000 AGI: `ageAtYearEnd: 16.999999`
         * takes Schedule 8812 line 14 to $2,200.00 and `17` takes it to
         * $500.00.
         *
         * Every bound below is HAND-TYPED, not read from
         * {@link oldestPlausibleDependentAge} — a fixture derived from the
         * constant under test moves with it and can never notice it moving,
         * which is the Phase 10 defect AGENTS.md records.
         */
        dependentAge: {
            /** The floor, the ceiling, and one step outside each. */
            theBoundariesRefuse: () => {
                for (const age of [-1, 151]) {
                    const [t, v] = validate({
                        ...minimal,
                        dependentCount: 1,
                        dependents: [{ relationship: 'daughter', ageAtYearEnd: age }],
                    })
                    assertEq(t, 'error', ['expected an out-of-range age to be refused', age, v])
                    assert(typeof v === 'string', ['expected a semantic string refusal', age, v])
                    assert(v.includes('ageAtYearEnd'), ['expected the field named', age, v])
                    assert(v.includes(String(age)), ['expected the offending VALUE quoted', age, v])
                }
            },
            /**
             * The control, and the half of this leaf that makes the one above
             * mean something: a gate that refuses everything passes a refusal
             * proof. `0` is a child born on 31 December; `150` is the bound
             * itself and is INCLUSIVE; `122` is the oldest verified human
             * lifetime and must never be refused — a §152(d) qualifying
             * relative has no age test.
             */
            theBoundariesThemselvesAreLegitimate: () => {
                for (const age of [0, 17, 122, 150]) {
                    const [t, v] = validate({
                        ...minimal,
                        dependentCount: 1,
                        dependents: [{ relationship: 'mother', ageAtYearEnd: age }],
                    })
                    assertEq(t, 'ok', ['expected a legitimate age to validate', age, v])
                }
            },
            /**
             * A fraction is the dangerous input, because it lands on the
             * RIGHT side of every consumer's threshold while not being an
             * age: `16.999999 < 17` is true, so Schedule 8812 pays the child
             * tax credit on it.
             */
            aFractionalAgeRefusesEvenInsideTheRange: () => {
                for (const age of [9.5, 16.999999, -0.0001]) {
                    const [t, v] = validate({
                        ...minimal,
                        dependentCount: 1,
                        dependents: [{ relationship: 'daughter', ageAtYearEnd: age }],
                    })
                    assertEq(t, 'error', ['expected a fractional age to be refused', age, v])
                    assert(typeof v === 'string', ['expected a semantic string refusal', age, v])
                    assert(v.includes(String(age)), ['expected the offending VALUE quoted', age, v])
                }
            },
            /**
             * On a multi-dependent return the refusal must say WHICH
             * dependent, the same reason check 9 names its index: a filer
             * with three children cannot act on "an age is wrong".
             */
            theRefusalNamesWhichDependent: () => {
                const [t, v] = validate({
                    ...minimal,
                    dependentCount: 3,
                    dependents: [
                        { relationship: 'daughter', ageAtYearEnd: 10 },
                        { relationship: 'son', ageAtYearEnd: 12 },
                        { relationship: 'son', ageAtYearEnd: 2025 },
                    ],
                })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(v.includes('dependents[2]'), ['expected the offending INDEX named', v])
                assert(v.includes('2025'), ['expected the offending VALUE quoted', v])
            },
            /**
             * The refusal must say what the number was supposed to be, not
             * merely that it was wrong. AGENTS.md, on the `${destination}`
             * mutation that survived a whole suite: assert the part of a
             * message that carries the information.
             */
            theRefusalQuotesTheRangeAndWhyItMatters: () => {
                const [, v] = validate({
                    ...minimal,
                    dependentCount: 1,
                    dependents: [{ relationship: 'daughter', ageAtYearEnd: 151 }],
                })
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(v.includes('0..150'), ['expected the permitted RANGE quoted', v])
                assert(v.includes('17'), ['expected the 8812 threshold the age decides named', v])
                assert(v.includes('152(c)(3)'), ['expected the EIC authority named', v])
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
            // Check 7b, the same gate on Schedule 3 line 10's own amount. The
            // refusal is asserted BY NAME rather than merely as an error: the
            // fixture below it would pass against a check that refused every
            // profile, and the pair is what AGENTS.md means by "a gate needs a
            // control".
            extensionPaymentWithoutDeclaredKindRefused: () => {
                const [t, v] = validate({
                    ...minimal,
                    scheduleThreeLine10AmountPaidWithExtensionRequest: '450.00',
                })
                assertEq(t, 'error')
                assert(typeof v === 'string', ['expected a semantic string refusal', v])
                assert(
                    v.includes('scheduleThreeLine10AmountPaidWithExtensionRequest'),
                    ['the refusal must name the offending box', v])
                assert(
                    v.includes('amountPaidWithExtensionRequest'),
                    ['and the kind that would have made it declarable', v])
            },
            extensionPaymentWithDeclaredKindAccepted: () => {
                const [t, v] = validate({
                    ...minimal,
                    declaredKinds: ['amountPaidWithExtensionRequest'],
                    scheduleThreeLine10AmountPaidWithExtensionRequest: '450.00',
                })
                assert(t === 'ok', ['expected ok', t, v])
                assertEq(v.scheduleThreeLine10AmountPaidWithExtensionRequest, '450.00')
            },
            // The two guards are INDEPENDENT: declaring one kind does not
            // license the other's box. Without this leaf, a check 7b written
            // against `'estimatedTaxPayments'` by copy-paste would pass every
            // leaf above.
            // §904(j)'s election flag, and it deliberately has NO
            // cross-field guard — the two leaves here pin that as a decision
            // rather than an omission. Declaring the election while claiming
            // no foreign tax is an ordinary return; the gate that matters
            // lives in `fjs/schedule/3`, where the stored foreign tax is.
            theSection904jElectionNeedsNoDeclaredKindOfItsOwn: () => {
                const [t, v] = validate({
                    ...minimal,
                    section904jElectionAllForeignIncomeIsQualifiedPassiveIncome: true,
                })
                assert(t === 'ok', ['electing while claiming nothing must validate', t, v])
                assertEq(v.section904jElectionAllForeignIncomeIsQualifiedPassiveIncome, true)
            },
            // DOC-12, the same discipline as every other checkbox on this
            // dialect: a structural `false` is REJECTED, never read as "not
            // electing". Absent means not elected; there is no third state,
            // and a stored `false` would be a second way to spell the first.
            theSection904jElectionRejectsAStoredFalse: () => {
                const [t] = validate({
                    ...minimal,
                    section904jElectionAllForeignIncomeIsQualifiedPassiveIncome: false,
                })
                assertEq(t, 'error')
            },
            // ── TAX-42: Form 2555's four checks ─────────────────────────
            //
            // The whole set, on a return that declares the kind and states
            // every fact — the shape `fjs/form1040/core` actually receives.
            formTwoFiveFiveFiveFieldsValidateTogether: () => {
                const [t, v] = validate({
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
                    foreignEarnedIncomeQualifyingDays: 140,
                    foreignEarnedIncome: '150000.00',
                    foreignEarnedIncomeDeductionsAllocableToExcludedIncome: '4000.00',
                    foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed: '1200.00',
                })
                assert(t === 'ok', ['a complete Form 2555 profile must validate', t, v])
                assertEq(v.foreignEarnedIncomeQualifyingDays, 140)
                assertEq(v.foreignEarnedIncome, '150000.00')
            },
            // DOC-12: a structural `false` on the certification is REJECTED,
            // never read as "not certified" — the discipline every other
            // checkbox on this dialect follows.
            thePhysicalPresenceCertificationRejectsAStoredFalse: () => {
                const [t] = validate({
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: false,
                })
                assertEq(t, 'error')
            },
            // Check 11 — every one of the five, one at a time, so a field
            // silently dropped from `formTwoFiveFiveFiveFields` reddens here
            // rather than passing because a NEIGHBOUR is still in the loop.
            // The `formTwoFiveFiveFiveFieldCount` leaf below is what catches a
            // field dropped from the LOOP as well as from this list.
            everyFormTwoFiveFiveFiveFieldNeedsTheDeclaredKind: () => {
                /** @type {readonly (readonly [string, string | number | true])[]} */
                const cases = [
                    ['physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode', true],
                    ['foreignEarnedIncomeQualifyingDays', 365],
                    ['foreignEarnedIncome', '90000.00'],
                    ['foreignEarnedIncomeDeductionsAllocableToExcludedIncome', '100.00'],
                    ['foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed', '100.00'],
                ]
                assertEq(cases.length, 5, 'five Form 2555 fields, hand-counted')
                for (const [field, value] of cases) {
                    const [t, v] = validate({ ...minimal, [field]: value })
                    assertEq(t, 'error', ['an unstated kind must refuse this field', field, v])
                    assert(typeof v === 'string', ['expected a semantic refusal', field, v])
                    assert(
                        v.includes(field) && v.includes('foreignEarnedIncomeExclusion'),
                        ['the refusal must name the field and the kind', field, v])
                }
            },
            // THE CONTROL for the loop above: with the kind declared, each of
            // the five validates on its own. Without this, a check 11 that
            // refused unconditionally would pass every assertion above.
            controlEachFormTwoFiveFiveFiveFieldValidatesWithTheKindDeclared: () => {
                const base = {
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
                    foreignEarnedIncomeQualifyingDays: 365,
                }
                for (const field of [
                    'foreignEarnedIncomeDeductionsAllocableToExcludedIncome',
                    'foreignEarnedIncomeItemizedDeductionsAndExclusionsNotClaimed',
                ]) {
                    const [t, v] = validate({ ...base, [field]: '100.00' })
                    assert(t === 'ok', ['the declared kind must admit this field', field, v])
                }
                const [t] = validate(base)
                assertEq(t, 'ok', 'and the certification with a day count alone validates')
            },
            // Check 12 — the day count's own boundaries, against
            // `vnd.fjs.rental_property`'s imported `daysInTheLongestYear`.
            // 366 is admitted and 367 is not, because this dialect does not
            // know whether the year it names is a leap year; the TIGHTER bound
            // is `fjs/form1040/core`'s, against the parameter set.
            theQualifyingDayCountIsRangeChecked: () => {
                const base = {
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                }
                assertEq(validate({ ...base, foreignEarnedIncomeQualifyingDays: 0 })[0], 'ok')
                assertEq(validate({ ...base, foreignEarnedIncomeQualifyingDays: 366 })[0], 'ok')
                assertEq(validate({ ...base, foreignEarnedIncomeQualifyingDays: 367 })[0], 'error')
                assertEq(validate({ ...base, foreignEarnedIncomeQualifyingDays: -1 })[0], 'error')
                assertEq(validate({ ...base, foreignEarnedIncomeQualifyingDays: 140.5 })[0], 'error')
            },
            // Check 13 — a stored foreign earned income needs BOTH the
            // certification and a day count. Two separate refusals, each
            // naming what is missing, because a filer told only "something is
            // wrong" cannot act.
            aStoredForeignEarnedIncomeNeedsTheCertificationAndTheDayCount: () => {
                const declared = {
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                    foreignEarnedIncome: '90000.00',
                }
                const [t1, v1] = validate({ ...declared, foreignEarnedIncomeQualifyingDays: 365 })
                assertEq(t1, 'error', 'no certification')
                assert(
                    typeof v1 === 'string' && v1.includes('physicallyPresent'),
                    ['the refusal must name the certification', v1])
                const [t2, v2] = validate({
                    ...declared,
                    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
                })
                assertEq(t2, 'error', 'no day count')
                assert(
                    typeof v2 === 'string' && v2.includes('foreignEarnedIncomeQualifyingDays'),
                    ['the refusal must name the missing day count', v2])
                assert(
                    typeof v2 === 'string' && v2.includes('is not 365'),
                    ['and say why an absent count is not a full year', v2])
            },
            // THE CONTROL: the certification and a day count WITHOUT an amount
            // is an ordinary return — a filer who qualified and earned nothing
            // abroad. Without this, a check 13 that refused the certification
            // itself would pass every assertion above.
            controlTheCertificationWithNoAmountValidates: () => {
                const [t, v] = validate({
                    ...minimal,
                    declaredKinds: ['foreignEarnedIncomeExclusion'],
                    physicallyPresentInAForeignCountryThreeHundredThirtyFullDaysAndNoUnitedStatesAbode: true,
                    foreignEarnedIncomeQualifyingDays: 200,
                })
                assert(t === 'ok', ['qualifying and earning nothing is an ordinary return', t, v])
            },
            eachExtensionAndEstimatedGuardWatchesItsOwnKind: () => {
                const [t1] = validate({
                    ...minimal,
                    declaredKinds: ['estimatedTaxPayments'],
                    scheduleThreeLine10AmountPaidWithExtensionRequest: '450.00',
                })
                assertEq(t1, 'error', 'the extension amount needs its OWN kind declared')
                const [t2] = validate({
                    ...minimal,
                    declaredKinds: ['amountPaidWithExtensionRequest'],
                    line26EstimatedTaxPayments: '1234.56',
                })
                assertEq(t2, 'error', 'and the estimated payment needs its own')
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
            // `or(option, true)` to `or(option, boolean)` passed `tsc --noEmit` AND
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
    // Form 3903's pre-line eligibility checkbox (§217(g)). Structurally
    // independent of every check above — no leaf here touches
    // `checkReferences`'s order or `declaredKinds`.
    formThreeNineZeroThreeEligibilityCertification: {
        movingExpensesArmedForcesPermanentChangeOfStationValidates: () => {
            const [t, v] = validate({
                ...minimal,
                movingExpensesArmedForcesPermanentChangeOfStation: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.movingExpensesArmedForcesPermanentChangeOfStation, true)
        },
        // DOC-12, same discipline as every other checkbox on this dialect: a
        // structural `false` is rejected, not accepted as "not applicable".
        // The distinction matters more here than anywhere else on this
        // dialect: `false` and ABSENT would both have to mean "did not
        // certify", and a stored `false` would look like a denial the engine
        // could act on, when what it actually has is silence.
        falseRejected: () => {
            const [t] = validate({
                ...minimal,
                movingExpensesArmedForcesPermanentChangeOfStation: false,
            })
            assertEq(t, 'error')
        },
        // THE CONTROL: the certification is OPTIONAL. A return that says
        // nothing about moving expenses validates, and it is the ordinary
        // case — a gate that made this field required would refuse every
        // civilian return on this dialect.
        absentValidates: () => {
            const [t, v] = validate({ ...minimal })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.movingExpensesArmedForcesPermanentChangeOfStation, undefined)
        },
    },
    // Form 4797 line 7's "you didn't have any prior year section 1231 losses"
    // certification, the same three-leaf shape.
    sectionTwelveThirtyOneLookbackCertification: {
        certificationValidates: () => {
            const [t, v] = validate({
                ...minimal,
                noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears, true)
        },
        // DOC-12. A stored `false` would read as "I DID have prior year §1231
        // losses, and here is nothing about how much" — a denial with no
        // amount behind it, which is worse than silence because a reader would
        // act on it.
        falseRejected: () => {
            const [t] = validate({
                ...minimal,
                noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears: false,
            })
            assertEq(t, 'error')
        },
        // THE CONTROL: absence is the ordinary case, and it is what makes
        // `fjs/form4797` refuse a GAIN year rather than this dialect refusing
        // the document. A return with no business property disposals says
        // nothing here and validates.
        absentValidates: () => {
            const [t, v] = validate({ ...minimal })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.noNonrecapturedNetSectionOneTwoThreeOneLossesFromPriorYears, undefined)
        },
    },
    // TAX-39 (Form 7206): §162(l)(2)(B)'s employer-plan disqualifier, the same
    // three-leaf shape `movingExpensesArmedForcesPermanentChangeOfStation`
    // has above — it validates, a structural `false` is rejected, and the
    // CONTROL shows absence is ordinary.
    selfEmployedHealthInsuranceCertification: {
        certificationValidates: () => {
            const [t, v] = validate({
                ...minimal,
                notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth, true)
        },
        // DOC-12. A stored `false` would read as a DENIAL the engine could act
        // on, when what it actually has is silence — and here the two would
        // reach the same refusal by different routes, which is exactly the
        // confusion this convention exists to prevent.
        falseRejected: () => {
            const [t] = validate({
                ...minimal,
                notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth: false,
            })
            assertEq(t, 'error')
        },
        // THE CONTROL. Every return that is not self-employed says nothing
        // here, and a gate that made this required would refuse all of them.
        absentValidates: () => {
            const [t, v] = validate({ ...minimal })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.notEligibleForAnySubsidizedEmployerHealthPlanInAnyMonth, undefined)
        },
    },
    // TAX-37 (Form 8962): the two Premium Tax Credit facts no information
    // return reports.
    premiumTaxCreditFacts: {
        // All three printed tables validate, driven off the frozen list so a
        // fourth added later is covered automatically -- paired below with a
        // hand-typed count, since a loop over the list under test cannot
        // notice that list shrinking.
        everyPrintedTableValidates: () => {
            for (const table of federalPovertyLineTableNames) {
                const [t, v] = validate({ ...minimal, federalPovertyLineTable: table })
                assert(t === 'ok', ['expected ok', table, t, v])
                assertEq(v.federalPovertyLineTable, table)
            }
        },
        // Independently hand-typed: Form 8962 line 4 prints THREE checkboxes
        // (Alaska, Hawaii, other 48 states and DC). Deliberately not
        // `federalPovertyLineTableNames.length` compared to itself.
        thereAreExactlyThreeTables: () => {
            assertEq(federalPovertyLineTableNames.length, 3)
            assertEq(
                new Set(federalPovertyLineTableNames).size,
                federalPovertyLineTableNames.length,
                'and no table is named twice')
        },
        // Check 10: an unrecognized answer is refused at INGEST, naming both
        // the offending value and the three that are admitted -- because a
        // value this dialect accepted and `fjs/tax/params` had no table for
        // would surface as an assertion failure deep inside Form 8962.
        anUnknownTableIsRefusedNamingTheThreeAdmitted: () => {
            const [t, v] = validate({ ...minimal, federalPovertyLineTable: 'puertoRico' })
            assertEq(t, 'error')
            assert(
                typeof v === 'string' && v.includes('puertoRico'),
                ['the refusal must quote what was stored', v])
            for (const table of ['contiguous48AndDistrictOfColumbia', 'alaska', 'hawaii']) {
                assert(
                    typeof v === 'string' && v.includes(table),
                    ['and must name every table that IS admitted', table, v])
            }
        },
        // A near-miss spelling is refused too -- the case a `startsWith` or a
        // case-insensitive comparison would have let through.
        aNearMissSpellingIsRefused: () => {
            assertEq(validate({ ...minimal, federalPovertyLineTable: 'Alaska' })[0], 'error')
            assertEq(validate({ ...minimal, federalPovertyLineTable: 'alaska ' })[0], 'error')
        },
        noDependentIsRequiredToFileValidates: () => {
            const [t, v] = validate({
                ...minimal,
                noDependentIsRequiredToFileAnIncomeTaxReturn: true,
            })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.noDependentIsRequiredToFileAnIncomeTaxReturn, true)
        },
        // DOC-12: a stored `false` would look like "I certify that a
        // dependent DOES have to file", which is a different statement from
        // silence and one this engine has no use for.
        noDependentIsRequiredToFileFalseRejected: () => {
            assertEq(
                validate({ ...minimal, noDependentIsRequiredToFileAnIncomeTaxReturn: false })[0],
                'error')
        },
        // THE CONTROL for both fields: neither is required, and a return that
        // says nothing about health coverage -- which is most returns --
        // validates exactly as it always did.
        bothAbsentValidates: () => {
            const [t, v] = validate({ ...minimal })
            assert(t === 'ok', ['expected ok', t, v])
            assertEq(v.federalPovertyLineTable, undefined)
            assertEq(v.noDependentIsRequiredToFileAnIncomeTaxReturn, undefined)
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
    // ── TAX-27 (Phase 32): the ten §32 asserted facts ───────────────────────
    //
    // Every leaf here is structurally independent of every check above: none
    // touches `checkReferences`'s first eight steps, `declaredKinds` or the
    // money loop.
    earnedIncomeCreditFacts: {
        ...generatedEarnedIncomeCreditVocabularyProof,
        // The count a generated leaf cannot supply: dropping a field from
        // `earnedIncomeCreditVocabularies` deletes its own leaf in the same
        // instant, so the loop above would happily iterate one fewer and stay
        // green (AGENTS.md, Phase 10's `unknownDialectRefused` shape). Both
        // numbers here are hand-typed off the statute, never read back off
        // the object they describe.
        everyFactFieldIsCovered: () => {
            assertEq(
                Object.keys(earnedIncomeCreditVocabularies).length,
                expectedEarnedIncomeCreditFactFieldCount,
                'ten §32 facts: five per dependent (§32(c)(3)) and five about the filer (§32(c)(1)/§32(m))',
            )
            assertEq(dependentFactFields.length, 5)
            assertEq(filerFactFields.length, 5)
            // The relationship vocabulary is the one with more than two
            // members, and its size is the check that the negative arm has
            // not been dropped -- see the vocabularies' own docstring, "The
            // relationship vocabulary has a NEGATIVE member".
            assertEq(earnedIncomeCreditVocabularies.earnedIncomeCreditRelationship.length, 6)
            assert(
                earnedIncomeCreditVocabularies.earnedIncomeCreditRelationship
                    .some(v => v === 'notAnEarnedIncomeCreditRelationship'),
                'a dependent parent must be expressible as NOT a §32(c)(3) qualifying child, '
                + 'or the childless credit becomes unreachable for a filer who has one',
            )
        },
        // The control the generated refusals need (AGENTS.md, "a gate needs a
        // control"): all ten fields present, every value from its own
        // vocabulary, and the profile validates. A vocabulary check that
        // refused everything would pass every leaf above and fail this one.
        allTenStatedValidate: () => {
            const [t, v] = validate(everyFactStated)
            assert(t === 'ok', ['expected the fully-stated profile to validate', t, v])
            assertEq(v.filerSocialSecurityNumber, 'validForEmployment')
            assertEq(v.filerPrincipalPlaceOfAbode, 'inTheUnitedStatesForMoreThanHalfTheYear')
            const entry = v.dependents?.[0]
            assert(entry !== undefined, ['expected a dependent entry', v])
            assertEq(entry.earnedIncomeCreditRelationship, 'child')
            assertEq(entry.earnedIncomeCreditUnitedStatesResidency,
                'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear')
        },
        // The three-state shape's own property: ABSENT is a legitimate stored
        // state, distinguishable from every stated one, and it is NOT
        // materialized as a key. This is the `specifiedServiceTradeOrBusiness`
        // leaf one dialect over, applied to the field where the wrong default
        // grants rather than denies.
        absenceIsAStateOfItsOwnAndIsNotMaterialized: () => {
            const [t, v] = validate(minimal)
            assert(t === 'ok', ['expected the minimal profile to validate', t, v])
            assertEq(v.filerSocialSecurityNumber, undefined)
            assert(
                !Object.keys(v).includes('filerSocialSecurityNumber'),
                ['an unstated fact must be an ABSENT key, never a materialized undefined', v],
            )
            // ... and a DENIAL is a third state, stored and readable back, so
            // "unstated" and "answered no" can never be confused downstream.
            const [dt, dv] = validate({ ...minimal, filerSocialSecurityNumber: 'notValidForEmployment' })
            assert(dt === 'ok', ['a denial is a legitimate stored state', dt, dv])
            assertEq(dv.filerSocialSecurityNumber, 'notValidForEmployment')
            assert(
                dv.filerSocialSecurityNumber !== v.filerSocialSecurityNumber,
                'a denial must be distinguishable from an absence',
            )
        },
        // `or(option, true)` would have accepted a bare `false` nowhere, but
        // `or(option, string)` must reject one explicitly -- and a materialized
        // `false` is precisely the serializer hazard this dialect's header
        // names. `''` is the other cheap way to write "nothing", and it is
        // refused by the vocabulary rather than accepted as an absence.
        booleanAndEmptyStringRefused: () => {
            assertEq(validate({ ...minimal, filerSocialSecurityNumber: false })[0], 'error')
            assertEq(validate({ ...minimal, filerPrincipalPlaceOfAbode: true })[0], 'error')
            const [t, v] = validate({ ...minimal, filerSocialSecurityNumber: '' })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic vocabulary refusal, not a structural one', v])
            assert(v.includes('filerSocialSecurityNumber'), ['expected the offending field named', v])
        },
        // A per-dependent refusal names WHICH dependent, which is the only
        // part of the message a filer with three children can act on --
        // AGENTS.md's own "assert the part that carries the information".
        perDependentRefusalNamesTheIndex: () => {
            const [t, v] = validate({
                ...minimal,
                dependentCount: 2,
                dependents: [
                    { relationship: 'son', ageAtYearEnd: 8, earnedIncomeCreditRelationship: 'child' },
                    { relationship: 'niece', ageAtYearEnd: 9, earnedIncomeCreditRelationship: 'niece' },
                ],
            })
            assertEq(t, 'error')
            assert(typeof v === 'string', ['expected a semantic string refusal', v])
            assert(v.includes('dependents[1]'), ['expected the offending dependent named by index', v])
            assert(v.includes('"niece"'), ['expected the offending value quoted', v])
            assert(
                v.includes('descendantOfAChildOrSibling'),
                ['expected the admissible vocabulary named, so the filer can see a niece is a DESCENDANT', v],
            )
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
            assert(t === 'error', ['expected error', t, v])
            assert(typeof v !== 'string', ['expected a structural ValidationError, got a checkReferences string', v])
            assertEq(v.path.length, 1)
            assertEq(v.path[0], 'dialect')
        },
    },
}
