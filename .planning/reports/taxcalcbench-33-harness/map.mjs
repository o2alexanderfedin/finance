// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
// TaxCalcBench (TY2024) input.json  ->  this engine's `Form1040Inputs`.
//
// SCRATCH ONLY. Not part of the repo, not a dependency, not shipped.
// `try` and impurity are legal here; the no-`try` rule scopes to `fjs/**.f.js`.

const TY = 2024
const REV = '2024'

/** benchmark leaf `{ label?, value }` -> raw value, or undefined */
export const v = node => (node === undefined || node === null ? undefined : node.value)

/** dollars (JSON number) -> exact decimal string, or undefined when absent/zero-and-optional */
export const money = (node, keepZero = false) => {
    const raw = v(node)
    if (raw === undefined || raw === null) { return undefined }
    const n = Number(raw)
    if (!Number.isFinite(n)) { return undefined }
    if (n === 0 && !keepZero) { return undefined }
    // benchmark amounts are small integers or 2dp; toFixed(2) is exact here.
    return n.toFixed(2)
}

export const moneyZero = node => money(node, true)

const sum = (list, f) => list.reduce((a, x) => a + Number(f(x) ?? 0), 0)

const arr = x => (Array.isArray(x) ? x : x === undefined || x === null ? [] : [x])

const FILING_STATUS = {
    single: 'single',
    married_jointly: 'marriedFilingJointly',
    married_separately: 'marriedFilingSeparately',
    married_filing_jointly: 'marriedFilingJointly',
    married_filing_separately: 'marriedFilingSeparately',
    head_of_household: 'headOfHousehold',
    qualifying_widow: 'qualifyingSurvivingSpouse',
    qualifying_surviving_spouse: 'qualifyingSurvivingSpouse',
}

// The benchmark writes dates BOTH ways -- '2002-12-12' and '2007/01/01'.
const iso = d => String(d).replace(/\//g, '-')

// The engine's profile field is spelled `taxpayerBornBeforeJan2_1961`, which
// is TY2025's own age-65 cutoff. The FACT it carries is "was 65 or older at
// the end of the tax year"; for TY2024 that cutoff is Jan 2, 1960, and that
// is the date used here.
const bornBefore = (dob, cutoff) => dob !== undefined && iso(dob) < cutoff

const EMPTY = [
    'w2s', 'interestForms', 'dividendForms', 'brokerageForms', 'retirementForms',
    'socialSecurityForms', 'itemizedDeductionForms', 'medicalExpenseForms',
    'capitalLossCarryoverForms', 'unemploymentForms', 'nonemployeeCompensationForms',
    'businessExpenseForms', 'assetRegisters', 'rentalProperties', 'farmForms',
    'adjustmentForms', 'studentLoanInterestForms', 'tuitionForms', 'creditForms',
    'iraForms', 'priorYearIraBasisForms', 'isoExerciseForms',
    'employeeStockPurchaseForms', 'basisCorrectionForms', 'partnershipK1Forms',
    'sCorporationK1Forms', 'estateTrustK1Forms', 'marketplaceStatements',
]

const TIN = '222-22-2222'
const SPOUSE_TIN = '333-33-3333'

const who = node => (v(node) === 'spouse' ? SPOUSE_TIN : TIN)

// Form 8949's payer-printed box letter (i8949 Part I A/B/C, Part II D/E/F),
// derived from the benchmark's `input_sale_term` + `input_irs8949_code`.
const EIGHT_NINE_FOUR_NINE = {
    'short_term|basis_reported': 'A',
    'short_term|basis_not_reported': 'B',
    'short_term|not_received': 'C',
    'long_term|basis_reported': 'D',
    'long_term|basis_not_reported': 'E',
    'long_term|not_received': 'F',
}

/**
 * @returns {{
 *   inputs: object,
 *   declaredKinds: string[],
 *   unmappable: string[],   // benchmark facts we could not express at all
 *   notes: string[],
 * }}
 */
export const mapCase = (name, j) => {
    const rd = j.input.return_data
    const h = j.input.return_header
    const f1040 = rd.irs1040 ?? {}
    const s1 = rd.irs1040_schedule1 ?? {}
    const s3 = rd.irs1040_schedule3 ?? {}
    const sb = rd.irs1040_scheduleb ?? {}
    const unmappable = []
    const notes = []
    const kinds = new Set()

    const status = FILING_STATUS[v(f1040.filing_status)]
    if (status === undefined) { unmappable.push('filing status ' + v(f1040.filing_status)) }

    // ── W-2 ────────────────────────────────────────────────────────────────
    const w2s = arr(rd.w2).map((w, i) => {
        // Box 12 is `employers_use_grp` in the benchmark's schema -- a name
        // that matches no box number and no IRS caption, which is why a first
        // pass missed it entirely and every box-12 case diverged by exactly
        // the box-12 total.
        const box12 = arr(w.employers_use_grp).flatMap(e => {
            const code = v(e.box_12_code)
            const amt = money(e.box_12_amount)
            return code === undefined || amt === undefined ? [] : [{ code: String(code), amount: amt }]
        })
        return {
            documentHash: 'sha256-w2-' + i,
            value: {
                dialect: 'vnd.fjs.w2',
                payerTin: String(v(w.ein) ?? '11-1111111'),
                recipientTin: who(w.who_applies_to),
                accountNumber: 'W2-' + i,
                taxYear: TY,
                formRevision: REV,
                ...opt('box1WagesTipsOtherCompensation', money(w.wages)),
                ...opt('box2FederalIncomeTaxWithheld', money(w.withholding)),
                ...opt('box3SocialSecurityWages', money(w.social_security_wages)),
                ...opt('box4SocialSecurityTaxWithheld', money(w.social_security_tax)),
                ...opt('box5MedicareWagesAndTips', money(w.medicare_wages_and_tips)),
                ...opt('box6MedicareTaxWithheld', money(w.medicare_tax_withheld)),
                ...opt('box7SocialSecurityTips', money(w.social_security_tips)),
                ...opt('box8AllocatedTips', money(w.allocated_tips)),
                ...opt('box10DependentCareBenefits', money(w.dependent_care_benefits)),
                ...opt('box11NonqualifiedPlans', money(w.nonqualified_plan)),
                ...(box12.length > 0 ? { box12 } : {}),
                ...(v(w.statutory_employee) === true ? { box13StatutoryEmployee: true } : {}),
                ...(v(w.retirement_plan) === true ? { box13RetirementPlan: true } : {}),
                ...(v(w.third_party_sick_pay) === true ? { box13ThirdPartySickPay: true } : {}),
                ...opt('employerName', v(w.employer_name)),
            },
        }
    })
    if (w2s.length > 0) { kinds.add('wages') }
    if (w2s.some(w => w.value.box2FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnW2') }
    if (w2s.some(w => w.value.box10DependentCareBenefits !== undefined)) { kinds.add('dependentCareBenefits') }
    // Box 12 codes A, B, M and N are uncollected social security / Medicare /
    // RRTA tax on tips or on group-term life insurance -> Schedule 2 line 13.
    if (w2s.some(w => (w.value.box12 ?? []).some(e => ['A', 'B', 'M', 'N'].includes(e.code)))) {
        kinds.add('uncollectedTaxOnTipsOrGroupTermLife')
    }
    if (w2s.some(w => w.value.box7SocialSecurityTips !== undefined || w.value.box8AllocatedTips !== undefined)) {
        notes.push('W-2 box 7/8 tips present')
    }

    // Additional Medicare Tax (§3101(b)(2)): thresholds 200k single/HOH,
    // 250k MFJ, 125k MFS — statutory and NOT inflation-adjusted, so the same
    // in TY2024 as in TY2025. A filer over the line owes it whether or not
    // they have heard of Form 8959, which is why the engine tripwires on it.
    const medicareWages = sum(arr(rd.w2), w => Number(v(w.medicare_wages_and_tips) ?? 0))
    const amtThreshold = status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse' ? 250000
        : status === 'marriedFilingSeparately' ? 125000 : 200000
    if (medicareWages > amtThreshold) { kinds.add('additionalMedicareTax') }

    // excess social security withheld (Schedule 3 line 11) — more than one employer
    const eins = new Set(arr(rd.w2).map(w => String(v(w.ein))))
    const ssTotal = sum(arr(rd.w2), w => Number(v(w.social_security_tax) ?? 0))
    if (eins.size > 1 && ssTotal > 10453.2) { kinds.add('excessSocialSecurityWithheld') }

    // ── 1099-INT ───────────────────────────────────────────────────────────
    const interestForms = arr(sb.irs1099_int).map((x, i) => ({
        documentHash: 'sha256-1099int-' + i,
        value: {
            dialect: 'vnd.fjs.1099int',
            payerTin: String(v(x.interest_1099int_payer_ein) ?? '11-2222222'),
            recipientTin: who(x.interest_1099int_who_applies_to),
            accountNumber: 'INT-' + i,
            taxYear: TY,
            formRevision: REV,
            ...opt('box1InterestIncome', money(x.interest_1099int_interest)),
            ...opt('box2EarlyWithdrawalPenalty', money(x.interest_1099int_early_withdrawal)),
            ...opt('box3UsSavingsBondsAndTreasuryInterest', money(x.interest_1099int_us_saving_bond_treasury_obligations)),
            ...opt('box4FederalIncomeTaxWithheld', money(x.interest_1099int_fed_inc_tax_withheld)),
            ...opt('box6ForeignTaxPaid', money(x.interest_1099int_foreign_taxes_paid)),
            ...opt('box8TaxExemptInterest', money(x.interest_1099int_tax_exempt)),
            ...opt('box9SpecifiedPrivateActivityBondInterest', money(x.interest_1099int_specified_private_act_bond)),
            ...opt('payerName', v(x.interest_1099int_payer)),
        },
    }))
    for (const x of arr(sb.irs1099_int)) {
        if (money(x.interest_1099int_bond_premium) !== undefined
            || money(x.interest_1099int_market_discount) !== undefined
            || money(x.interest_1099int_investment_expenses) !== undefined
            || money(x.interest_1099int_bond_premium_treasury_obligations) !== undefined
            || money(x.interest_1099int_bond_premium_tax_exempt) !== undefined) {
            unmappable.push('1099-INT boxes 5/10/11/12/13 (bond premium, market discount, investment expenses) — no field on vnd.fjs.1099int')
        }
    }
    if (interestForms.some(x => x.value.box1InterestIncome !== undefined || x.value.box3UsSavingsBondsAndTreasuryInterest !== undefined)) { kinds.add('taxableInterest') }
    if (interestForms.some(x => x.value.box8TaxExemptInterest !== undefined)) { kinds.add('taxExemptInterest') }
    if (interestForms.some(x => x.value.box4FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOn1099Int') }

    // ── 1099-DIV ───────────────────────────────────────────────────────────
    const dividendForms = arr(sb.irs1099_div).map((x, i) => ({
        documentHash: 'sha256-1099div-' + i,
        value: {
            dialect: 'vnd.fjs.1099div',
            sourceArtifactHash: 'bhtsw5fzcphk3hqrsyzk5wzp2ktnkkfnc8p8w6ynqxwlfa2vcrfg',
            payerTin: '11-3333333',
            recipientTin: who(x.dividend_1099div_who_applies_to),
            accountNumber: 'DIV-' + i,
            taxYear: TY,
            formRevision: REV,
            ...opt('box1aTotalOrdinaryDividends', money(x.dividend_1099div_ordinary_div)),
            ...opt('box1bQualifiedDividends', money(x.dividend_1099div_qualified_div)),
            ...opt('box2aTotalCapitalGainDistr', money(x.dividend_1099div_capital_gain_distr)),
            ...opt('box2bUnrecapSec1250Gain', money(x.dividend_1099div_unrecap_sec_1250_gain)),
            ...opt('box2cSection1202Gain', money(x.dividend_1099div_section_1202_gain)),
            ...opt('box2dCollectibles28PercentGain', money(x.dividend_1099div_collectibles_gain)),
            ...opt('box3NondividendDistributions', money(x.dividend_1099div_nondividend_distributions)),
            ...opt('box4FederalIncomeTaxWithheld', money(x.dividend_1099div_federal_inc_tax_withheld)),
            ...opt('box5Section199ADividends', money(x.dividend_1099div_section_199a_dividends)),
            ...opt('box6InvestmentExpenses', money(x.dividend_1099div_investment_expenses)),
            ...opt('box7ForeignTaxPaid', money(x.dividend_1099div_foreign_tax_paid)),
            ...opt('box12ExemptInterestDividends', money(x.dividend_1099div_exempt_interest_div)),
            ...opt('box13SpecifiedPrivateActivityBondInterestDividends', money(x.dividend_1099div_specified_private_activity_bond)),
            ...opt('payerName', v(x.dividend_1099div_payer)),
        },
    }))
    if (dividendForms.some(x => x.value.box1aTotalOrdinaryDividends !== undefined)) { kinds.add('ordinaryDividends') }
    if (dividendForms.some(x => x.value.box1bQualifiedDividends !== undefined)) { kinds.add('qualifiedDividends') }
    if (dividendForms.some(x => x.value.box2aTotalCapitalGainDistr !== undefined)) { kinds.add('capitalGainDistributions') }
    if (dividendForms.some(x => x.value.box2bUnrecapSec1250Gain !== undefined)) { kinds.add('unrecaptured1250Gain') }
    if (dividendForms.some(x => x.value.box2dCollectibles28PercentGain !== undefined)) { kinds.add('collectibles28RateGain') }
    if (dividendForms.some(x => x.value.box5Section199ADividends !== undefined)) { kinds.add('qualifiedReitDividends') }
    if (dividendForms.some(x => x.value.box4FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnOther1099') }

    // ── 1099-G (unemployment) ──────────────────────────────────────────────
    const unemploymentForms = arr(s1.irs1099_g).map((x, i) => ({
        documentHash: 'sha256-1099g-' + i,
        value: {
            dialect: 'vnd.fjs.1099g',
            payerTin: String(v(x.g_payer_tin) ?? '11-4444444'),
            recipientTin: who(x.g_who_applies_to),
            accountNumber: 'G-' + i,
            taxYear: TY,
            formRevision: REV,
            ...opt('box1UnemploymentCompensation', money(x.g_unemployment_comp)),
            ...opt('box4FederalIncomeTaxWithheld', money(x.g_fed_wh)),
            ...opt('payerName', v(x.g_payer_name)),
        },
    }))
    for (const x of arr(s1.irs1099_g)) {
        if (money(x.g_amount_repaid_current_year) !== undefined || money(x.g_amount_repaid_prior_years) !== undefined) {
            unmappable.push('1099-G unemployment REPAYMENT (no box on Form 1099-G; the benchmark carries it as a separate field)')
        }
    }
    if (unemploymentForms.some(x => x.value.box1UnemploymentCompensation !== undefined)) { kinds.add('unemploymentCompensation') }
    if (unemploymentForms.some(x => x.value.box4FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnOther1099') }

    // ── 1099-R ─────────────────────────────────────────────────────────────
    const retirementForms = arr(rd.irs1099_r).map((x, i) => ({
        documentHash: 'sha256-1099r-' + i,
        value: {
            dialect: 'vnd.fjs.1099r',
            payerTin: String(v(x.payer_ein_input) ?? '11-5555555'),
            recipientTin: who(x.who_applies_to),
            accountNumber: 'R-' + i,
            taxYear: TY,
            formRevision: REV,
            ...opt('box1GrossDistribution', money(x.gross_distribution_amt_input)),
            ...opt('box2aTaxableAmount', money(x.taxable_amt_input)),
            ...(v(x.txbl_amount_not_determined_ind_input) === true ? { box2bTaxableAmountNotDetermined: true } : {}),
            ...(v(x.total_distribution_ind_input) === true ? { box2bTotalDistribution: true } : {}),
            ...opt('box3CapitalGain', money(x.capital_gain_amt_input)),
            ...opt('box4FederalIncomeTaxWithheld', money(x.federal_income_tax_withheld_amt_input)),
            ...opt('box5EmployeeContribOrInsurancePremiums', money(x.employee_contributions_amt_input)),
            ...(v(x.f1099_r_distribution_cd_input) === undefined
                ? {}
                : { box7aDistributionCodes: String(v(x.f1099_r_distribution_cd_input)).split('') }),
            ...(v(x.irasepsimple_ind_input) === true ? { box7bIraSepSimple: true } : {}),
            ...opt('payerName', v(x.payer_name_business_name_input)),
        },
    }))
    if (retirementForms.length > 0) {
        const isIra = retirementForms.some(x => x.value.box7bIraSepSimple === true)
        kinds.add(isIra ? 'iraDistributions' : 'pensionsAndAnnuities')
        if (retirementForms.some(x => x.value.box4FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnOther1099') }
    }

    // ── SSA-1099 ───────────────────────────────────────────────────────────
    const socialSecurityForms = arr(rd.ssa_1099?.ssa_1099_grp).map((x, i) => ({
        documentHash: 'sha256-ssa-' + i,
        value: {
            dialect: 'vnd.fjs.ssa1099',
            // The SSA-1099 prints no payer TIN, and this dialect refuses a
            // non-empty one by name.
            payerTin: '',
            recipientTin: who(x.ssa_who_applies_to),
            accountNumber: 'SSA-' + i,
            taxYear: TY,
            formRevision: REV,
            ...opt('box4BenefitsRepaid', money(x.ssa_lump_sum_benefits)),
            ...opt('box5NetBenefits', money(x.ssa_net_benefits)),
            ...opt('box6VoluntaryFederalIncomeTaxWithheld', money(x.ssa_federal_withholding)),
        },
    }))
    if (socialSecurityForms.length > 0) { kinds.add('socialSecurityBenefits') }
    if (socialSecurityForms.some(x => x.value.box6VoluntaryFederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnOther1099') }

    // ── 1099-B / Form 8949 ─────────────────────────────────────────────────
    const brokerageForms = []
    for (const grp of arr(rd.irs8949?.irs1099_b_grp)) {
        for (const b of arr(grp.irs1099_b)) {
            const term = v(b.input_sale_term)
            const proceeds = moneyZero(b.proceeds)
            const basis = moneyZero(b.cost_basis)
            const idx = brokerageForms.length
            brokerageForms.push({
                documentHash: 'sha256-1099b-' + idx,
                value: {
                    dialect: 'vnd.fjs.1099b',
                    sourceArtifactHash: 'bhtsw5fzcphk3hqrsyzk5wzp2ktnkkfnc8p8w6ynqxwlfa2vcrfg',
                    payerTin: String(v(b.payer_ein) ?? '11-7777777'),
                    recipientTin: who(grp.who_applies_to),
                    accountNumber: 'B-' + idx,
                    taxYear: TY,
                    formRevision: REV,
                    ...opt('applicableCheckboxOnForm8949', EIGHT_NINE_FOUR_NINE[String(v(b.input_sale_term)) + '|' + String(v(b.input_irs8949_code))]),
                    ...opt('box1aDescriptionOfProperty', v(b.desc_of_prop)),
                    ...opt('box1bDateAcquired', v(b.acquired_dt)),
                    ...opt('box1cDateSoldOrDisposed', v(b.sold_disposed_dt)),
                    ...opt('box1dProceeds', proceeds),
                    ...opt('box1eCostOrOtherBasis', basis),
                    ...(v(b.input_irs8949_code) === 'basis_reported' ? { box12BasisReportedToIrs: true } : {}),
                    ...opt('box1fAccruedMarketDiscount', money(b.accrued_market_discount)),
                    ...opt('box1gWashSaleLossDisallowed', money(b.wash_sale_loss)),
                    ...(term === 'short_term' ? { box2ShortTermGainOrLoss: true }
                        : term === 'long_term' ? { box2LongTermGainOrLoss: true } : {}),
                    ...opt('box4FederalIncomeTaxWithheld', money(b.fed_inc_tax_wh)),
                    ...opt('payerName', v(grp.payer_name)),
                },
            })
        }
    }
    if (brokerageForms.length > 0) { kinds.add('capitalGainsOrLosses') }
    if (brokerageForms.some(x => x.value.box4FederalIncomeTaxWithheld !== undefined)) { kinds.add('federalTaxWithheldOnOther1099') }

    // ── prior-year capital loss carryover ──────────────────────────────────
    const sd = rd.irs1040_schedule_d ?? {}
    const stCarry = money(sd.st_capital_loss_carryover_input)
    const ltCarry = money(sd.lt_capital_loss_carryover_input)
    const capitalLossCarryoverForms = []
    if (stCarry !== undefined || ltCarry !== undefined) {
        unmappable.push('capital loss carryover: benchmark supplies the CARRYOVER AMOUNTS directly; vnd.fjs.prior_year_capital_loss wants the prior return\'s own line 15 / Schedule D lines 7, 15, 21')
    }

    // ── Schedule C ─────────────────────────────────────────────────────────
    // Benchmark Schedule C key -> this engine's closed expense-category
    // vocabulary (`fjs/schedule/c`'s `computedExpenseCategories` +
    // `refusedExpenseCategories`). The refused ones are mapped DELIBERATELY:
    // a return carrying depletion or a pension plan SHOULD refuse by name.
    const SCHED_C = {
        advertising: 'advertising', commissions_fees: 'commissionsAndFees',
        contract_labor: 'contractLabor', depletion: 'depletion',
        employee_benefit: 'employeeBenefitPrograms', insurance: 'insuranceOtherThanHealth',
        mortgage_interest: 'mortgageInterest', other_interest: 'otherInterest',
        legal_professional: 'legalAndProfessionalServices', office_expense: 'officeExpense',
        pension_psp: 'pensionAndProfitSharingPlans',
        machinery_equip_rent: 'rentOrLeaseVehiclesMachineryEquipment',
        other_rent: 'rentOrLeaseOtherBusinessProperty', repairs_maintenance: 'repairsAndMaintenance',
        supplies: 'supplies', tax_licenses: 'taxesAndLicenses', travel: 'travel',
        meal_entertainment: 'deductibleMeals', utilities: 'utilities', wages_expense: 'wages',
    }
    const businessExpenseForms = arr(rd.irs1040_schedulec).map((c, i) => ({
        documentHash: 'sha256-schedc-' + i,
        value: {
            dialect: 'vnd.fjs.business_expenses',
            recipientTin: who(c.who_applies_to),
            accountNumber: 'C-' + i,
            taxYear: TY,
            principalBusiness: String(v(c.business_act) ?? 'Consulting'),
            ...opt('businessName', v(c.business_name)),
            ...(money(c.gross_receipts_cash) !== undefined
                ? { grossReceiptsFullyReportedOnForms1099Nec: true }
                : {}),
            ...opt('priorYearQualifiedBusinessLossCarryforward', money(rd.irs8995a_schedulec?.prior_yr_qbi_loss_carryforward)),
            // Three states, not a boolean: absence is a third answer the
            // engine turns into a refusal, so BOTH answers are stored.
            specifiedServiceTradeOrBusiness:
                v(c.specified_service) === true ? 'specifiedService' : 'notSpecifiedService',
            ...opt('w2Wages', money(c.wages_paid)),
            ...opt('unadjustedBasisOfQualifiedProperty', money(c.ubia_qualified_property)),
            entries: Object.entries(SCHED_C).flatMap(([bk, category]) => {
                const amount = money(c[bk])
                return amount === undefined ? [] : [{
                    category,
                    datePaid: '2024-06-30',
                    description: bk,
                    amount,
                }]
            }),
        },
    }))
    if (businessExpenseForms.length > 0) {
        kinds.add('businessIncomeOrLoss')
        kinds.add('selfEmploymentTax')
        kinds.add('deductiblePartOfSelfEmploymentTax')
        if (arr(rd.irs1040_schedulec).some(c => v(c.qualified_business) === true)) { kinds.add('qualifiedBusinessIncomeDeduction') }
        if (arr(rd.irs1040_schedulec).some(c => money(c.se_health_insurance) !== undefined)) { kinds.add('selfEmployedHealthInsuranceDeduction') }
        if (arr(rd.irs1040_schedulec).some(c => money(c.gross_receipts_cash) !== undefined)) {
            notes.push('Schedule C gross receipts arrive as a benchmark scalar; this engine reads receipts from 1099-NEC/1099-MISC documents')
        }
        if (arr(rd.irs1040_schedulec).some(c => money(c.total_home_area) !== undefined)) {
            unmappable.push('Schedule C business use of home (Form 8829) — benchmark supplies areas only')
        }
        if (arr(rd.irs1040_schedulec).length > 1) { notes.push('two Schedule C businesses; this engine models one and refuses a second by name') }
    }

    // Schedule C gross receipts have to reach the engine as 1099-NEC documents.
    const nonemployeeCompensationForms = arr(rd.irs1040_schedulec).flatMap((c, i) => {
        const gross = money(c.gross_receipts_cash)
        return gross === undefined ? [] : [{
            documentHash: 'sha256-1099nec-' + i,
            value: {
                dialect: 'vnd.fjs.1099nec',
                payerTin: '11-8888888',
                recipientTin: who(c.who_applies_to),
                accountNumber: 'NEC-' + i,
                taxYear: TY,
                formRevision: REV,
                box1NonemployeeCompensation: gross,
            },
        }]
    })

    // ── Schedule A (itemized) ──────────────────────────────────────────────
    const itemizedDeductionForms = []
    if (v(rd.will_itemize) === true) {
        unmappable.push('itemized deductions elected, but the benchmark input carries no Schedule A amounts')
    }

    // ── Student loan interest (1098-E) ─────────────────────────────────────
    const sli = money(s1.student_interest)
    const studentLoanInterestForms = sli === undefined ? [] : [{
        documentHash: 'sha256-1098e-0',
        value: {
            dialect: 'vnd.fjs.1098e',
            payerTin: '11-9999999',
            recipientTin: TIN,
            accountNumber: 'E-0',
            taxYear: TY,
            formRevision: REV,
            box1StudentLoanInterestReceived: sli,
        },
    }]
    if (studentLoanInterestForms.length > 0) { kinds.add('studentLoanInterestDeduction') }

    // ── Educator expenses (vnd.fjs.adjustments) ────────────────────────────
    const jointReturn = status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse'
    const eduTp = money(s1.tp_educator_exp_amount)
    const eduSp = jointReturn ? money(s1.sp_educator_exp_amount) : undefined
    if (!jointReturn && money(s1.sp_educator_exp_amount) !== undefined) {
        notes.push("benchmark carries a SPOUSE educator expense on a non-joint return; dropped (no spouse exists on this return)")
    }
    const adjustmentForms = []
    if (eduTp !== undefined || eduSp !== undefined) {
        const entries = []
        if (eduTp !== undefined) { entries.push({ lineTag: 'educatorExpenses', datePaid: '2024-06-30', description: 'classroom supplies', amount: eduTp, individual: 'taxpayer' }) }
        if (eduSp !== undefined) { entries.push({ lineTag: 'educatorExpenses', datePaid: '2024-06-30', description: 'classroom supplies', amount: eduSp, individual: 'spouse' }) }
        adjustmentForms.push({
            documentHash: 'sha256-adjustments-0',
            value: { dialect: 'vnd.fjs.adjustments', recipientTin: TIN, taxYear: TY, entries },
        })
        kinds.add('educatorExpenses')
    }

    // ── Education credits (1098-T + credits) ───────────────────────────────
    const tuitionForms = []
    const students = arr(rd.irs8863?.student_educational_instn_grp)
    students.forEach((s, si) => {
        arr(s.educational_institution_group).forEach((inst, ii) => {
            const qe = money(inst.qualified_expenses)
            if (qe === undefined) { return }
            tuitionForms.push({
                documentHash: 'sha256-1098t-' + si + '-' + ii,
                value: {
                    dialect: 'vnd.fjs.1098t',
                    payerTin: String(v(inst.ein) ?? '11-1010101'),
                    recipientTin: TIN,
                    accountNumber: 'T-' + si + '-' + ii,
                    taxYear: TY,
                    formRevision: REV,
                    box1PaymentsReceivedForQualifiedTuition: qe,
                    ...(v(inst.current_year_1098t_received) === true ? {} : {}),
                },
            })
        })
    })
    const educationStudents = students.flatMap((s, si) => {
        const anyExpense = arr(s.educational_institution_group).some(inst => money(inst.qualified_expenses) !== undefined)
        if (!anyExpense) { return [] }
        return [{
            studentTin: TIN,
            studentName: String(v(f1040.tp_first_name) ?? 'Student'),
            credit: 'americanOpportunity',
            // `academic_period_eligible_student` is the benchmark's own
            // "enrolled at least half-time towards a degree program";
            // `post_secondary_education` is "finished their first 4 years
            // before 2024". The two are different questions and reading the
            // labels rather than the key names is what separates them.
            ...(v(s.academic_period_eligible_student) === true ? { enrolledAtLeastHalfTimeInADegreeProgram: true } : {}),
            ...(v(s.post_secondary_education) === true ? { completedFirstFourYearsOfPostsecondaryEducation: true } : {}),
            ...(v(s.drug_felony_conviction) === true ? { convictedOfAFelonyDrugOffense: true } : {}),
            ...(v(s.prior_year_credit_claimed) === true ? { americanOpportunityClaimedForFourPriorYears: true } : {}),
        }]
    })
    if (tuitionForms.length > 0) { kinds.add('educationCredits'); kinds.add('americanOpportunityCredit') }

    // ── Form 2441 dependent care (vnd.fjs.credits) ─────────────────────────
    const c2441 = rd.irs2441 ?? {}
    const creditForms = []
    // Form 8880 line 2 reads elective deferrals off Form W-2 box 12 itself.
    // What `vnd.fjs.credits` has to supply is the §25B eligibility facts.
    const DEFERRAL_CODES = ['D', 'E', 'F', 'G', 'H', 'S', 'AA', 'BB', 'EE']
    const hasDeferral = w2s.some(w => (w.value.box12 ?? []).some(e => DEFERRAL_CODES.includes(e.code)))
    const filerAge = 2024 - Number(iso(v(f1040.tp_date_of_birth) ?? '1980-01-01').slice(0, 4))
    if (hasDeferral && v(f1040.tp_dependent) !== true && filerAge >= 18) {
        kinds.add('retirementSavingsContributionsCredit')
        creditForms.push({
            documentHash: 'sha256-credits-savers',
            value: {
                dialect: 'vnd.fjs.credits',
                recipientTin: TIN,
                taxYear: TY,
                saversCreditEligibility: [{
                    individual: 'taxpayer',
                    attainedAgeEighteen: true,
                    wasAFullTimeStudent: v(f1040.tp_student) === true,
                    noTestingPeriodDistributions: true,
                }],
            },
        })
    }
    if (educationStudents.length > 0) {
        creditForms.push({
            documentHash: 'sha256-credits-0',
            value: {
                dialect: 'vnd.fjs.credits',
                recipientTin: TIN,
                taxYear: TY,
                // §25A(i)'s age test, derived from the filer's own date of
                // birth in the benchmark's `tp_date_of_birth`.
                ...(2024 - Number(String(v(f1040.tp_date_of_birth) ?? '1980-01-01').slice(0, 4)) >= 24
                    ? { filerAttainedAgeTwentyFourBeforeTheEndOfTheYear: true }
                    : {}),
                educationStudents,
            },
        })
    }
    const careExpenses = money(c2441.qualified_expenses ?? c2441.total_expenses)
    if (w2s.some(w => w.value.box10DependentCareBenefits !== undefined) || careExpenses !== undefined) {
        kinds.add('dependentCareCredit')
        notes.push('Form 2441 present; the benchmark carries only adjustments/carryover/forfeited amounts, not the provider table or the qualified-expense total the engine reads')
    }

    // ── Form 1095-A ────────────────────────────────────────────────────────
    const m8962 = rd.irs8962 ?? {}
    const marketplaceStatements = []
    if (v(m8962.received_1095a) === true) {
        const a = Number(v(m8962.annual_premium) ?? 0)
        const b = Number(v(m8962.annual_premium_slcsp) ?? 0)
        const c = Number(v(m8962.annual_advanced_ptc) ?? 0)
        marketplaceStatements.push({
            documentHash: 'sha256-1095a-0',
            value: {
                dialect: 'vnd.fjs.1095a',
                marketplaceIdentifier: '99',
                marketplaceAssignedPolicyNumber: 'POLICY-0001',
                policyIssuerName: 'Benchmark Health',
                recipientTin: TIN,
                taxYear: TY,
                formRevision: REV,
                sourceArtifactHash: 'bhtsw5fzcphk3hqrsyzk5wzp2ktnkkfnc8p8w6ynqxwlfa2vcrfg',
                coveredIndividuals: [{ name: String(v(f1040.tp_first_name) ?? 'Filer') }],
                monthlyCoverage: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => ({
                    month,
                    columnAEnrollmentPremiums: (a / 12).toFixed(2),
                    columnBSlcspPremium: (b / 12).toFixed(2),
                    columnCAdvancePaymentOfPtc: (c / 12).toFixed(2),
                })),
            },
        })
        kinds.add('netPremiumTaxCredit')
        kinds.add('excessAdvancePremiumTaxCreditRepayment')
        notes.push('Form 1095-A: benchmark gives ANNUAL totals only (boxes 33A/B/C); the engine reads twelve printed monthly rows, so the harness spreads the annual figure evenly')
    }

    // ── Facts that have no document at all ─────────────────────────────────
    if (v(rd.received_form_1099K) === true) {
        unmappable.push('Form 1099-K — NO DIALECT (`vnd.fjs.1099k` does not exist)')
    }
    if (money(s1.alaska_permanent_dividend_tp_input) !== undefined) {
        // The kind IS in the frozen vocabulary, so the taxpayer can declare
        // it and be told by name that it is not modeled. Declaring it is the
        // honest mapping -- the benchmark's filer really does have one -- and
        // it makes the engine refuse BEFORE any line computes, rather than
        // the harness silently dropping the income.
        kinds.add('alaskaPermanentFundDividends')
        notes.push('Alaska Permanent Fund dividend declared; the kind is in the vocabulary but is not modeled')
    }
    if (arr(rd.depreciation).length > 0 || (rd.depreciation !== undefined && !Array.isArray(rd.depreciation) && v(rd.depreciation) !== false)) {
        notes.push('depreciation block present')
    }

    // ── Payments and elections carried on the profile ──────────────────────
    const estimated = ['estimated_tax_payment_1', 'estimated_tax_payment_2', 'estimated_tax_payment_3', 'estimated_tax_payment_4']
        .reduce((a, k) => a + Number(v(f1040[k]) ?? 0), 0) + Number(v(f1040.applied_from_prior_year) ?? 0)
    if (estimated > 0) { kinds.add('estimatedTaxPayments') }
    const extension = money(s3.extension_payment)
    if (extension !== undefined) { kinds.add('amountPaidWithExtensionRequest') }

    // ── Dependents ─────────────────────────────────────────────────────────
    const DEP_REL = {
        son: 'son', daughter: 'daughter', child: 'child', stepchild: 'stepchild',
        grandchild: 'grandchild', brother: 'brother', sister: 'sister',
        parent: 'parent', mother: 'mother', father: 'father', other: 'other',
    }
    const deps = arr(f1040.dependent_detail).map(d => {
        const dob = iso(v(d.dependent_date_of_birth) ?? '2010-01-01')
        const age = 2024 - Number(dob.slice(0, 4)) - (dob.slice(5) > '12-31' ? 1 : 0)
        const rel = String(v(d.dependent_relationship) ?? 'child').toLowerCase().replace(/[^a-z]/g, '')
        return {
            relationship: DEP_REL[rel] ?? 'child',
            ssnValidForEmployment: true,
            ageAtYearEnd: age,
            livedWithTaxpayer: true,
            earnedIncomeCreditRelationship:
                ['son', 'daughter', 'child', 'stepchild', 'grandchild'].includes(DEP_REL[rel] ?? 'child')
                    ? 'child' : 'notAnEarnedIncomeCreditRelationship',
            earnedIncomeCreditFullTimeStudent: v(d.dependent_student) === true ? 'wasAFullTimeStudent' : 'wasNotAFullTimeStudent',
            earnedIncomeCreditPermanentAndTotalDisability: 'notPermanentlyAndTotallyDisabled',
            earnedIncomeCreditUnitedStatesResidency: 'sharedTheTaxpayersUnitedStatesAbodeForMoreThanHalfTheYear',
            earnedIncomeCreditJointReturn: 'didNotFileAJointReturn',
        }
    })
    if (deps.length > 0) {
        kinds.add('childTaxCreditOrOtherDependents')
        kinds.add('additionalChildTaxCredit')
    }
    if (v(f1040.eic_not_allowed) !== true) { kinds.add('earnedIncomeCredit') }

    // ── The profile ────────────────────────────────────────────────────────
    const tpDob = iso(v(f1040.tp_date_of_birth) ?? '1980-01-01')
    const spDob = v(f1040.sp_date_of_birth) === undefined ? undefined : iso(v(f1040.sp_date_of_birth))
    const isJoint = status === 'marriedFilingJointly' || status === 'qualifyingSurvivingSpouse'

    const profileValue = {
        dialect: 'vnd.fjs.return_profile',
        taxYear: TY,
        filingStatus: status ?? 'single',
        dependentCount: deps.length,
        declaredKinds: [...kinds],
        wholeDollarElection: true,
        ...(v(f1040.tp_dependent) === true ? { claimedAsDependent: true } : {}),
        ...(bornBefore(tpDob, '1960-01-02') ? { taxpayerBornBeforeJan2_1961: true } : {}),
        ...(v(f1040.tp_blind) === true ? { taxpayerIsBlind: true } : {}),
        ...(isJoint && spDob !== undefined && bornBefore(spDob, '1960-01-02') ? { spouseBornBeforeJan2_1961: true } : {}),
        ...(isJoint && v(f1040.sp_blind) === true ? { spouseIsBlind: true } : {}),
        ...(deps.length > 0 ? { dependents: deps } : {}),
        ...(estimated > 0 ? { line26EstimatedTaxPayments: estimated.toFixed(2) } : {}),
        // Schedule 8812's own earned income (line 18a). The engine keeps this
        // deliberately separate from §32's EIC earned income and reads it off
        // the profile; for a wage-only filer it is the box-1 total.
        ...(w2s.length > 0
            ? { earnedIncome: sum(arr(rd.w2), w => Number(v(w.wages) ?? 0)).toFixed(2) }
            : {}),
        ...(extension !== undefined ? { scheduleThreeLine10AmountPaidWithExtensionRequest: extension } : {}),
        ...(v(sb.foreign_accounts_input) === true ? { hadForeignFinancialAccount: true } : {}),
        ...(v(sb.foreign_trust_input) === true ? { receivedForeignTrustDistributionOrWasGrantorOrTransferor: true } : {}),
        filerSocialSecurityNumber: 'validForEmployment',
        ...(isJoint ? { spouseSocialSecurityNumber: 'validForEmployment' } : {}),
        filerQualifyingChildOfAnotherTaxpayer: v(f1040.qualifying_child_of_another) === true
            ? 'isAnotherTaxpayersQualifyingChild' : 'isNotAnotherTaxpayersQualifyingChild',
        filerAttainedAgeTwentyFiveButNotSixtyFive: (() => {
            const age = 2024 - Number(tpDob.slice(0, 4))
            return age >= 25 && age < 65 ? 'attainedAgeTwentyFiveButNotSixtyFive'
                : 'didNotAttainAgeTwentyFiveOrHasAttainedSixtyFive'
        })(),
        filerPrincipalPlaceOfAbode: v(f1040.main_home_not_us) === true
            ? 'notInTheUnitedStatesForMoreThanHalfTheYear' : 'inTheUnitedStatesForMoreThanHalfTheYear',
        ...(marketplaceStatements.length > 0
            ? { federalPovertyLineTable: v(h.state) === 'AK' ? 'alaska' : v(h.state) === 'HI' ? 'hawaii' : 'contiguous48AndDistrictOfColumbia' }
            : {}),
        ...(deps.length > 0 ? { noDependentIsRequiredToFileAnIncomeTaxReturn: true } : {}),
    }

    const inputs = {
        profile: { documentHash: 'sha256-profile', value: profileValue },
        ...Object.fromEntries(EMPTY.map(k => [k, []])),
        w2s, interestForms, dividendForms, brokerageForms, retirementForms,
        socialSecurityForms, unemploymentForms, nonemployeeCompensationForms,
        businessExpenseForms, capitalLossCarryoverForms, itemizedDeductionForms,
        studentLoanInterestForms, adjustmentForms, tuitionForms, creditForms,
        marketplaceStatements,
    }

    return { inputs, declaredKinds: [...kinds], unmappable: [...new Set(unmappable)], notes }
}

const opt = (k, val) => (val === undefined ? {} : { [k]: val })
