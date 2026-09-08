// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine, not typechecked, not shipped.
//
// Diffs this engine's line-16 machinery against Publication 17 (2025) --
// every printed row of the 2025 Tax Table, all four 2025 Tax Rate Schedules,
// and all twenty rows of the 2025 Tax Computation Worksheet.
//
//   FINANCE_ROOT=../../.. node sweep-p17.mjs
//
// The engine is called; the expectations come only from `p17-tax-table.json`
// and `p17-schedules.mjs`, both of which come off the printed page.
import { readFileSync } from 'node:fs'
import { taxRateSchedules, taxComputationWorksheet as printedWorksheet, expectedCounts } from './p17-schedules.mjs'

const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const HERE = new URL('.', import.meta.url).pathname

const { lookupTaxTable, cumulativeBracketTaxCents, taxComputationWorksheet } =
    await import(R + '/fjs/tax/table/module.f.js')
const { taxParamsByYear } = await import(R + '/fjs/tax/params/module.f.js')
const { centsFromString, centsToString } = await import(R + '/fjs/exact/module.f.js')

const params = taxParamsByYear[2025]
const dollars = n => BigInt(n) * 100n
const COLUMNS = ['single', 'marriedFilingJointly', 'marriedFilingSeparately', 'headOfHousehold']

const diffs = []
const disagree = (what, where, ours, theirs) => diffs.push({ what, where, ours, theirs })

// ── 1. The printed 2025 Tax Table, row by row ──────────────────────────────
const printedRows = JSON.parse(readFileSync(HERE + 'p17-tax-table.json', 'utf8'))
let tableCells = 0
for (const [atLeast, lessThan, ...columns] of printedRows) {
    const row = lookupTaxTable(params)(dollars(atLeast))
    if (row.atLeastCents !== dollars(atLeast) || row.lessThanCents !== dollars(lessThan)) {
        disagree('tax table band', `$${atLeast}`,
            `${centsToString(row.atLeastCents)}-${centsToString(row.lessThanCents)}`,
            `${atLeast}-${lessThan}`)
    }
    COLUMNS.forEach((column, i) => {
        tableCells += 1
        if (row[column] !== dollars(columns[i])) {
            disagree('tax table ' + column, `$${atLeast}`, centsToString(row[column]), String(columns[i]))
        }
    })
}

// ── 2. The four printed Tax Rate Schedules ─────────────────────────────────
// A schedule's `over` boundaries are the stored bracket ceilings, and its
// printed `base` is the tax at that boundary -- so the two together pin both
// halves of every bracket. Schedule Y-1's heading covers the qualifying
// surviving spouse, so the engine's separately hand-typed QSS schedule is
// checked against it as well.
const SCHEDULE_FOR = {
    single: 'single',
    marriedFilingJointly: 'marriedFilingJointly',
    marriedFilingSeparately: 'marriedFilingSeparately',
    headOfHousehold: 'headOfHousehold',
    qualifyingSurvivingSpouse: 'marriedFilingJointly',
}
let scheduleRows = 0
for (const [status, schedule] of Object.entries(SCHEDULE_FOR)) {
    const printed = taxRateSchedules[schedule]
    if (printed.length !== expectedCounts.rateScheduleRowsPerSchedule) {
        disagree('rate schedule row count', status, String(printed.length),
            String(expectedCounts.rateScheduleRowsPerSchedule))
    }
    const brackets = params.ordinaryBrackets[status].brackets
    printed.forEach((printedRow, i) => {
        scheduleRows += 1
        const bracket = brackets[i]
        if (bracket === undefined) {
            disagree('rate schedule bracket missing', `${status} row ${i}`, 'absent', String(printedRow.ratePercent))
            return
        }
        if (bracket.ratePercent !== printedRow.ratePercent) {
            disagree('rate schedule rate', `${status} over $${printedRow.over}`,
                String(bracket.ratePercent), String(printedRow.ratePercent))
        }
        const ceiling = bracket.ceiling === undefined ? null : Number(bracket.ceiling.split('.')[0])
        if (ceiling !== printedRow.butNotOver) {
            disagree('rate schedule ceiling', `${status} over $${printedRow.over}`,
                String(ceiling), String(printedRow.butNotOver))
        }
        // The printed "The tax is: $X + n%" constant is the cumulative tax at
        // the row's own `over` boundary. `cumulativeBracketTaxCents` returns an
        // exact, unrounded `Rational` -- a `[numerator, denominator]` pair in
        // cents -- so the comparison cross-multiplies rather than rounding,
        // which would hide a fractional-cent disagreement.
        const [numerator, denominator] = cumulativeBracketTaxCents(brackets)(dollars(printedRow.over))
        const theirs = centsFromString(printedRow.base)
        if (numerator !== theirs * denominator) {
            disagree('rate schedule base', `${status} over $${printedRow.over}`,
                `${numerator}/${denominator}`, printedRow.base)
        }
    })
}

// ── 3. The twenty printed Tax Computation Worksheet rows ───────────────────
// Each row is evaluated at its own lower bound and, where the row is closed,
// one dollar below its upper bound -- the two incomes at which an off-by-one
// band boundary shows.
if (printedWorksheet.length !== expectedCounts.worksheetRows) {
    disagree('worksheet row count', 'all', String(printedWorksheet.length), String(expectedCounts.worksheetRows))
}
let worksheetProbes = 0
for (const row of printedWorksheet) {
    const probes = row.butNotOver === null
        ? [row.atLeast, row.atLeast + 100000]
        : [row.atLeast, row.butNotOver - 1]
    for (const income of probes) {
        worksheetProbes += 1
        const cents = dollars(income)
        // The printed row, evaluated exactly as a filer with a calculator
        // would: (a) x (b) - (d), in cents, with no engine arithmetic.
        const theirs = (cents * BigInt(row.ratePercent)) / 100n - centsFromString(row.subtraction)
        const ours = taxComputationWorksheet(params.ordinaryBrackets[row.status].brackets)(cents)
        if (ours !== theirs) {
            disagree('worksheet', `${row.status} $${income}`, centsToString(ours), centsToString(theirs))
        }
    }
}

console.log('Publication 17 (2025) cross-check')
console.log('  tax table rows            ', printedRows.length)
console.log('  tax table money cells     ', tableCells)
console.log('  rate schedule rows        ', scheduleRows)
console.log('  worksheet probes          ', worksheetProbes)
console.log('  DISAGREEMENTS             ', diffs.length)
for (const d of diffs.slice(0, 60)) { console.log('   ', JSON.stringify(d)) }
process.exitCode = diffs.length === 0 ? 0 : 1
