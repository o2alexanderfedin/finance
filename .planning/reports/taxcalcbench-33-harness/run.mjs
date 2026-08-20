// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
// Runs every TaxCalcBench TY2024 case through this engine and classifies the
// result: matched / refused / diverged / unrunnable.  SCRATCH ONLY.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { mapCase } from './map.mjs'

const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const HERE = process.env.BENCH_ROOT ?? '.'
const DATA = HERE + '/tax-calc-bench/tax_calc_bench/ty24/test_data'

const { form1040Report } = await import(R + '/fjs/form1040/core/module.f.js')
const PARAMS = process.env.PARAMS ?? './params2024.mjs'
const { taxParams2024, overridden = [], leftAtTy2025 = [] } = await import(PARAMS)

// The 20 lines TaxCalcBench itself grades (tax_return_evaluator.py's
// LINES_TO_XPATH_VALUES), each paired with this engine's `rule` string.
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

const expectedOf = xml => {
    const body = (xml.match(/<IRS1040 [\s\S]*?<\/IRS1040>/) ?? [''])[0]
    const out = {}
    for (const [line, tag] of GRADED) {
        const m = body.match(new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>'))
        // absent tag = the IRS schema omits a zero line; treat as 0.
        out[line] = m === null ? 0 : Number(m[1])
    }
    return out
}

const ruled = (lines, rule) => lines.find(x => x.rule === rule || x.rule.startsWith(rule + ' ('))

const results = []
for (const name of readdirSync(DATA).sort()) {
    const j = JSON.parse(readFileSync(DATA + '/' + name + '/input.json', 'utf8'))
    const expected = expectedOf(readFileSync(DATA + '/' + name + '/output.xml', 'utf8'))
    let mapped
    try { mapped = mapCase(name, j) } catch (e) {
        results.push({ name, status: 'harness-error', detail: String(e).slice(0, 300) })
        continue
    }
    // Line 34/35a/36 are a taxpayer ELECTION, not a computation: the filer
    // says how much of the overpayment to have refunded. The benchmark
    // encodes it as `refund_method`. This engine wants the AMOUNT, so where
    // the benchmark says "refund it", run once to learn line 34 and then
    // re-run with that as the elected refund. The election is the taxpayer's
    // own statement -- it does not feed any computed line.
    const wantsRefund = ['direct_deposit', 'check', 'paper_check']
        .includes(String(j.input.return_data.irs1040?.refund_method?.value ?? 'direct_deposit'))

    let outcome
    try { outcome = form1040Report(taxParams2024)(mapped.inputs) } catch (e) {
        results.push({
            name, status: 'threw', detail: JSON.stringify(e, (_, x) => typeof x === 'bigint' ? String(x) : x).slice(0, 400),
            declaredKinds: mapped.declaredKinds, unmappable: mapped.unmappable, notes: mapped.notes,
        })
        continue
    }
    if (outcome.kind === 'error') {
        results.push({
            name, status: 'refused', message: outcome.message,
            unmodeled: [...outcome.unmodeled],
            declaredKinds: mapped.declaredKinds, unmappable: mapped.unmappable, notes: mapped.notes,
        })
        continue
    }
    if (wantsRefund) {
        const overpaid = ruled(outcome.lines, '1040 line 34')
        if (overpaid !== undefined && overpaid.value > 0n) {
            const cents = overpaid.value
            const elected = (cents / 100n) + '.' + String(cents % 100n).padStart(2, '0')
            const again = form1040Report(taxParams2024)({
                ...mapped.inputs,
                profile: {
                    ...mapped.inputs.profile,
                    value: { ...mapped.inputs.profile.value, line35aRefundRequested: elected },
                },
            })
            if (again.kind === 'ok') { outcome = again }
        }
    }

    const lines = {}
    const diffs = []
    for (const [line, , rule] of GRADED) {
        const found = ruled(outcome.lines, rule)
        const ours = found === undefined ? null : Number(found.value) / 100
        lines[line] = ours
        if (ours === null) { continue }
        if (Math.round(ours) !== Math.round(expected[line])) {
            diffs.push({ line, ours: Math.round(ours), theirs: Math.round(expected[line]) })
        }
    }
    // A case whose input carries a fact this engine has NO WAY to receive is
    // not a divergence and not a refusal -- the harness dropped income the
    // engine never saw, so its numbers answer a different question. Bucket it
    // separately and name what was dropped.
    const dropped = mapped.unmappable.length > 0
    results.push({
        name, status: dropped ? 'unrunnable' : diffs.length === 0 ? 'matched' : 'diverged',
        line16Method: outcome.line16Method, lines, expected, diffs,
        declaredKinds: mapped.declaredKinds, unmappable: mapped.unmappable, notes: mapped.notes,
    })
}

writeFileSync(HERE + '/results.json', JSON.stringify(results, null, 1))

const by = {}
for (const r of results) { by[r.status] = (by[r.status] ?? 0) + 1 }
console.log('params2024: overridden', overridden.length, '| left at TY2025', leftAtTy2025.length)
console.log('TOTALS:', JSON.stringify(by))
console.log('')
for (const r of results) {
    const tail = r.status === 'unrunnable' ? ' :: ' + r.unmappable.join(' ; ').slice(0, 150)
        : r.status === 'refused' ? ' :: ' + r.message.slice(0, 150)
        : r.status === 'diverged' ? ' :: ' + r.diffs.map(d => `L${d.line} ours=${d.ours} theirs=${d.theirs}`).join(', ')
            : r.status === 'threw' || r.status === 'harness-error' ? ' :: ' + r.detail.slice(0, 150) : ''
    console.log(r.status.padEnd(13), r.name.padEnd(58), tail)
}
