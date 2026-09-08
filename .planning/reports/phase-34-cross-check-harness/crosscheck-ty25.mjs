// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine, not typechecked, not shipped.
//
// Diffs this engine against the ten Tax Year 2025 Forms 1040 in
// `ty25-published.mjs`, line by line, for every line whose INPUT the
// published return itself states — line 12e from the filing status and box
// count, line 16 from taxable income. It also prints, for every line it does
// NOT check, why: that census is the honest half of the result and the report
// quotes it.
//
//   FINANCE_ROOT=../../.. node crosscheck-ty25.mjs
//
// `fjs/tax/crosscheck/module.f.js` carries the same comparison as a proof
// `npm test` runs. This script is the readable form, and the place to add a
// case when a new published return appears.
import { cases, expectedCounts } from './ty25-published.mjs'

const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname

const { baseTaxForAmount } = await import(R + '/fjs/tax/table/module.f.js')
const { standardDeductionCents } = await import(R + '/fjs/tax/deduction/module.f.js')
const { taxParamsByYear } = await import(R + '/fjs/tax/params/module.f.js')
const { centsToString } = await import(R + '/fjs/exact/module.f.js')

const params = taxParamsByYear[2025]
const dollars = n => BigInt(n) * 100n
// Round half away from zero, to whole dollars, in cents. Written out rather
// than imported from `fjs/types/rational` so the expected side of this script
// shares nothing with the engine beyond the two functions under test.
const wholeDollars = cents => {
    const sign = cents < 0n ? -1n : 1n
    const magnitude = cents * sign
    return sign * ((magnitude + 50n) / 100n) * 100n
}

if (cases.length !== expectedCounts.returns) {
    throw new Error('expected ' + expectedCounts.returns + ' published returns, found ' + cases.length)
}

const rows = []
const diffs = []
let standardDeductionChecked = 0
let lineSixteenChecked = 0

for (const published of cases) {
    const notes = []

    if (published.deduction === 'standard') {
        standardDeductionChecked += 1
        const ours = standardDeductionCents(params)({
            status: published.filingStatus,
            agedOrBlindBoxes: published.agedOrBlindBoxes,
            claimedAsDependent: false,
            spouseItemizes: false,
            dualStatusAlien: false,
            earnedIncomeCents: 0n,
        })
        const theirs = dollars(published.lines['12'])
        notes.push('line 12e ' + (ours === theirs ? 'agrees' : 'DIFFERS'))
        if (ours !== theirs) {
            diffs.push({ name: published.name, line: '12', ours: centsToString(ours), theirs: String(published.lines['12']) })
        }
    } else {
        notes.push('line 12e itemized — not a parameter this engine can be asked for in isolation')
    }

    if (published.preferentialIncome === null) {
        lineSixteenChecked += 1
        const ours = baseTaxForAmount(params)(published.filingStatus)(dollars(published.lines['15']))
        const theirs = dollars(published.lines['16'])
        const rounded = wholeDollars(ours.cents)
        notes.push('line 16 ' + (rounded === theirs ? 'agrees' : 'DIFFERS') + ' via ' + ours.method
            + (ours.cents === rounded ? '' : ' (exact ' + centsToString(ours.cents) + ')'))
        if (rounded !== theirs) {
            diffs.push({ name: published.name, line: '16', ours: centsToString(ours.cents), theirs: String(published.lines['16']) })
        }
    } else {
        notes.push('line 16 needs the preferential-rate worksheet: ' + published.preferentialIncome)
    }

    rows.push({ name: published.name, status: published.filingStatus, notes })
}

if (standardDeductionChecked !== expectedCounts.standardDeduction) {
    throw new Error('expected ' + expectedCounts.standardDeduction + ' standard-deduction returns')
}
if (lineSixteenChecked !== expectedCounts.noPreferentialIncome) {
    throw new Error('expected ' + expectedCounts.noPreferentialIncome + ' returns without preferential income')
}

console.log('TaxCalcBench tax year 2025 federal returns, against taxParamsByYear[2025]')
console.log('  returns                   ', cases.length)
console.log('  line 12e compared         ', standardDeductionChecked)
console.log('  line 16 compared          ', lineSixteenChecked)
console.log('  DISAGREEMENTS             ', diffs.length)
console.log('')
for (const row of rows) {
    console.log(row.name.padEnd(13), row.status.padEnd(26), row.notes.join(' | '))
}
for (const d of diffs) { console.log('  DIFF', JSON.stringify(d)) }
process.exitCode = diffs.length === 0 ? 0 : 1
