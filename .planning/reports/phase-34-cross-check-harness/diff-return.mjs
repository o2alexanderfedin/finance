// @ts-nocheck
//
// Phase 34 harness. NOT part of the engine, not typechecked, not shipped.
//
// **The part of Phase 34 that is waiting for the owner.** The roadmap asks
// for the owner's own documents run through a free commercial filer and
// through this engine, diffed line by line. Everything except the documents
// exists; this is the diff, ready for the day they do.
//
//   FINANCE_ROOT=../../.. node diff-return.mjs ./my-return.mjs ./filer-export.xml
//
// The first argument is a module exporting `inputs`, a `Form1040Inputs` — the
// same shape `fjs/form1040/core/module.f.js`'s own proofs build, and the same
// shape `.planning/reports/taxcalcbench-33-harness/map.mjs` produces. The
// second is whatever the commercial filer exports. Most free filers
// (FreeTaxUSA, and the IRS Free File partners) will hand over the Modernized
// e-File `Return` document or a PDF of the finished form; this script reads
// the XML, because a PDF has to be transcribed by hand and a transcription is
// a third implementation nobody asked for.
//
// It prints the nineteen Form 1040 lines TaxCalcBench's own evaluator grades
// — a set chosen because it is somebody else's, so this project cannot be
// accused of grading itself on the lines it happens to get right.
import { readFileSync } from 'node:fs'

const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const [inputsPath, xmlPath] = process.argv.slice(2)
if (inputsPath === undefined || xmlPath === undefined) {
    console.error('usage: node diff-return.mjs <inputs module> <filer Return xml>')
    process.exit(2)
}

const { form1040Report } = await import(R + '/fjs/form1040/core/module.f.js')
const { taxParamsByYear } = await import(R + '/fjs/tax/params/module.f.js')
const { inputs } = await import(inputsPath.startsWith('.') ? new URL(inputsPath, import.meta.url).pathname : inputsPath)

// The nineteen graded lines: the printed line number, the Modernized e-File
// tag the filer's export carries it under, and the `rule` string this engine
// stamps on its own report line. Taken verbatim from TaxCalcBench's
// `tax_return_evaluator.py` and `ty25_scoring.py`.
const GRADED = [
    ['1a', 'WagesAmt', '1040 line 1a'],
    ['9', 'TotalIncomeAmt', '1040 line 9'],
    ['10', 'TotalAdjustmentsAmt', '1040 line 10'],
    ['11', 'AdjustedGrossIncomeAmt', '1040 line 11b'],
    ['12', 'TotalItemizedOrStandardDedAmt', '1040 line 12e'],
    ['15', 'TaxableIncomeAmt', '1040 line 15'],
    ['16', 'TaxAmt', '1040 line 16'],
    ['19', 'CTCODCAmt', '1040 line 19'],
    ['24', 'TotalTaxAmt', '1040 line 24'],
    ['25d', 'WithholdingTaxAmt', '1040 line 25d'],
    ['26', 'EstimatedTaxPaymentsAmt', '1040 line 26'],
    ['27', 'EarnedIncomeCreditAmt', '1040 line 27a'],
    ['28', 'AdditionalChildTaxCreditAmt', '1040 line 28'],
    ['29', 'RefundableAmerOppCreditAmt', '1040 line 29'],
    ['32', 'RefundableCreditsAmt', '1040 line 32'],
    ['33', 'TotalPaymentsAmt', '1040 line 33'],
    ['34', 'OverpaidAmt', '1040 line 34'],
    ['35a', 'RefundAmt', '1040 line 35a'],
    ['37', 'OwedAmt', '1040 line 37'],
]

const xml = readFileSync(xmlPath, 'utf8')
const body = (xml.match(/<IRS1040 [\s\S]*?<\/IRS1040>/) ?? [''])[0]
// The schema omits a zero line rather than printing it, so an absent tag is a
// zero — not a missing answer. Stated here because reading it the other way
// would manufacture a disagreement on every line the filer left blank.
const theirs = line => {
    const tag = GRADED.find(([number]) => number === line)[1]
    const found = body.match(new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>'))
    return found === null ? 0 : Number(found[1])
}

const outcome = form1040Report(taxParamsByYear[2025])(inputs)
if (outcome.kind === 'error') {
    // A refusal is an answer, not a crash: it names the printed line and the
    // fact it lacks. Print it and stop — diffing a return this engine
    // declined to produce would compare nothing against something.
    console.log('REFUSED:', outcome.message)
    process.exit(1)
}

const ruled = rule => outcome.lines.find(x => x.rule === rule || x.rule.startsWith(rule + ' ('))

let compared = 0
const diffs = []
console.log('line   ours        theirs      ')
for (const [line, , rule] of GRADED) {
    const found = ruled(rule)
    if (found === undefined) {
        console.log(line.padEnd(6), 'not produced by this engine')
        continue
    }
    compared += 1
    const ours = Math.round(Number(found.value) / 100)
    const filer = Math.round(theirs(line))
    const flag = ours === filer ? '' : '   <-- DISAGREE'
    console.log(line.padEnd(6), String(ours).padEnd(11), String(filer).padEnd(11) + flag)
    if (ours !== filer) { diffs.push({ line, ours, theirs: filer, rule: found.rule }) }
}

console.log('')
console.log('lines compared', compared, 'of', GRADED.length, '| disagreements', diffs.length)
// A disagreement is the point of the exercise, so it exits non-zero: this is
// meant to be run until it either agrees or has produced a finding, never to
// be run once and forgotten because it printed something.
process.exitCode = diffs.length === 0 ? 0 : 1
