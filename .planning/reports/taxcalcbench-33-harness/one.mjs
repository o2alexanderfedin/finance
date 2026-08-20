// @ts-nocheck
//
// Phase 33 harness. NOT part of the engine and NOT typechecked, for the same
// reason the root-level gate suites are not: it reads the filesystem, which
// needs `@types/node`, and AGENTS.md forbids adding a dependency for it.
import { readFileSync } from 'node:fs'
import { mapCase } from './map.mjs'
const R = process.env.FINANCE_ROOT ?? new URL('../../..', import.meta.url).pathname
const HERE = process.env.BENCH_ROOT ?? '.'
const DATA = HERE + '/tax-calc-bench/tax_calc_bench/ty24/test_data'
const { form1040Report } = await import(R + '/fjs/form1040/core/module.f.js')
const { taxParams2024 } = await import(process.env.PARAMS ?? './params2024.mjs')
const name = process.argv[2]
const j = JSON.parse(readFileSync(DATA + '/' + name + '/input.json', 'utf8'))
const m = mapCase(name, j)
console.log('declaredKinds:', m.declaredKinds.join(' '))
console.log('unmappable:', JSON.stringify(m.unmappable))
console.log('notes:', JSON.stringify(m.notes))
if (process.env.DUMP === 'inputs') { console.log(JSON.stringify(m.inputs, null, 1)) }
const o = form1040Report(taxParams2024)(m.inputs)
if (o.kind === 'error') { console.log('REFUSED:', o.message); console.log('unmodeled:', o.unmodeled) }
else {
    console.log('method:', o.line16Method)
    for (const x of o.lines) {
        if (x.value !== 0n || process.env.ALL === '1') {
            console.log(String(x.rule).padEnd(34), String(Number(x.value) / 100).padStart(12), '  <-', x.sources.map(s => s.boxPath + '=' + s.value).join(' | ').slice(0, 160))
        }
    }
}
